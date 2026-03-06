const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const result = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key.startsWith('--')) {
      result[key.slice(2)] = value;
      index += 1;
    }
  }
  return result;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function createState(payload) {
  return {
    status: 'queued',
    step: 'bootstrap',
    manual_step_reason: '',
    manual_step_instructions: '',
    external_policy_number: '',
    last_error: '',
    runtime_state: {},
    started_at: nowIso(),
    finished_at: null,
    log: [
      {
        timestamp: nowIso(),
        level: 'info',
        step: 'bootstrap',
        message: 'Runner started.',
      },
    ],
    payload,
  };
}

function appendLog(state, message, step, level = 'info') {
  state.log.push({
    timestamp: nowIso(),
    level,
    step,
    message,
  });
}

function sanitizeError(error) {
  const message = String(error && error.message ? error.message : error || 'Unknown error');
  return message
    .replace(process.env.SBER_ISSUANCE_PASSWORD || '', '[MASKED]')
    .replace(process.env.SBER_ISSUANCE_LOGIN || '', '[MASKED]');
}

async function waitForCommand(controlPath, expectedCommands, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const control = readJson(controlPath);
    if (control && expectedCommands.includes(control.command)) {
      return control.command;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function detectManualBarrier(page) {
  const pageText = await page.locator('body').innerText().catch(() => '');
  const normalized = pageText.toLowerCase();
  if (
    normalized.includes('смс') ||
    normalized.includes('sms') ||
    normalized.includes('код подтверждения') ||
    normalized.includes('капча') ||
    normalized.includes('captcha')
  ) {
    return 'Требуется ручное подтверждение входа или антибот-проверка.';
  }
  return '';
}

async function clickLogin(page, state) {
  const textInput = page.locator('input[type="TEXT"], input[type="text"]').first();
  const passwordInput = page.locator('input[type="PASSWORD"], input[type="password"]').first();
  const login = process.env.SBER_ISSUANCE_LOGIN || '';
  const password = process.env.SBER_ISSUANCE_PASSWORD || '';
  if ((await textInput.count()) > 0 && login) {
    await textInput.fill(login);
    appendLog(state, 'Логин заполнен.', 'login');
  }
  if ((await passwordInput.count()) > 0 && password) {
    await passwordInput.fill(password);
    appendLog(state, 'Пароль заполнен.', 'login');
  }

  const loginButton = page.getByText('Войти', { exact: true }).first();
  if ((await loginButton.count()) > 0) {
    await loginButton.click();
    appendLog(state, 'Нажата кнопка входа.', 'login');
  }
}

function detectPolicyNumber(text) {
  const patterns = [
    /полис\s*№?\s*([A-ZА-Я0-9-]{6,})/i,
    /номер\s+полиса\s*:?\s*([A-ZА-Я0-9-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return '';
}

async function maybeCaptureFailure(page, screenshotDir, fileName) {
  if (!screenshotDir) {
    return;
  }
  const targetDir = path.resolve(screenshotDir);
  fs.mkdirSync(targetDir, { recursive: true });
  await page.screenshot({
    path: path.join(targetDir, fileName),
    fullPage: true,
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const payloadPath = args.payload;
  const controlPath = args.control;
  const resultPath = args.result;
  const screenshotDir = process.env.SBER_ISSUANCE_SCREENSHOT_DIR || '';
  const manualTimeoutSeconds = Number(process.env.SBER_ISSUANCE_MANUAL_TIMEOUT_SECONDS || '900');
  const payload = readJson(payloadPath) || {};
  const state = createState(payload);
  writeJson(resultPath, state);

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (error) {
    state.status = 'failed';
    state.step = 'bootstrap';
    state.last_error = 'Playwright не установлен в tools/sber_issuance.';
    state.finished_at = nowIso();
    appendLog(state, state.last_error, 'bootstrap', 'error');
    writeJson(resultPath, state);
    process.exit(1);
  }

  const profileRoot = process.env.SBER_ISSUANCE_PROFILE_DIR || path.dirname(resultPath);
  const userDataDir = path.join(profileRoot, String(payload.policyId || 'default'));
  fs.mkdirSync(userDataDir, { recursive: true });

  let context;
  try {
    state.status = 'running';
    state.step = 'launch_browser';
    appendLog(state, 'Запускаем browser context.', 'launch_browser');
    writeJson(resultPath, state);

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: String(process.env.SBER_ISSUANCE_HEADLESS || 'false') === 'true',
      viewport: { width: 1440, height: 1024 },
    });
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(process.env.SBER_ISSUANCE_BASE_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    state.step = 'login';
    appendLog(state, 'Открыта страница Сбера.', 'login');
    writeJson(resultPath, state);

    await clickLogin(page, state);
    await page.waitForTimeout(3000);
    const barrier = await detectManualBarrier(page);
    if (barrier) {
      state.status = 'waiting_manual';
      state.step = 'manual_login';
      state.manual_step_reason = barrier;
      state.manual_step_instructions =
        'Подключитесь к серверному браузеру по VNC/RDP, завершите вход и затем нажмите "Продолжить" в CRM.';
      appendLog(state, barrier, 'manual_login', 'warn');
      writeJson(resultPath, state);

      const command = await waitForCommand(controlPath, ['resume', 'cancel'], manualTimeoutSeconds);
      if (command === 'cancel') {
        state.status = 'canceled';
        state.finished_at = nowIso();
        appendLog(state, 'Сценарий отменён пользователем.', 'manual_login', 'warn');
        writeJson(resultPath, state);
        await context.close();
        process.exit(0);
      }
      if (command !== 'resume') {
        state.status = 'failed';
        state.last_error = 'Истек таймаут ожидания ручного подтверждения.';
        state.finished_at = nowIso();
        appendLog(state, state.last_error, 'manual_login', 'error');
        writeJson(resultPath, state);
        await maybeCaptureFailure(page, screenshotDir, 'manual-timeout.png');
        await context.close();
        process.exit(1);
      }
      state.status = 'running';
      state.step = 'post_manual_resume';
      state.manual_step_reason = '';
      appendLog(state, 'Получена команда продолжить.', 'post_manual_resume');
      writeJson(resultPath, state);
    }

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const policyNumber = detectPolicyNumber(bodyText);
    if (policyNumber) {
      state.status = 'succeeded';
      state.step = 'completed';
      state.external_policy_number = policyNumber;
      state.finished_at = nowIso();
      appendLog(state, `Получен номер полиса ${policyNumber}.`, 'completed');
      writeJson(resultPath, state);
      await context.close();
      process.exit(0);
    }

    state.status = 'waiting_manual';
    state.step = 'manual_issue_confirmation';
    state.manual_step_reason = 'Автоматический выпуск не подтверждён. Требуется ручная проверка финального шага.';
    state.manual_step_instructions =
      'Завершите оформление в браузере, дождитесь появления номера полиса и затем нажмите "Продолжить" в CRM.';
    appendLog(state, state.manual_step_reason, 'manual_issue_confirmation', 'warn');
    writeJson(resultPath, state);

    const command = await waitForCommand(controlPath, ['resume', 'cancel'], manualTimeoutSeconds);
    if (command === 'cancel') {
      state.status = 'canceled';
      state.finished_at = nowIso();
      appendLog(state, 'Сценарий отменён пользователем.', 'manual_issue_confirmation', 'warn');
      writeJson(resultPath, state);
      await context.close();
      process.exit(0);
    }
    if (command !== 'resume') {
      state.status = 'failed';
      state.last_error = 'Истек таймаут ожидания ручного завершения оформления.';
      state.finished_at = nowIso();
      appendLog(state, state.last_error, 'manual_issue_confirmation', 'error');
      writeJson(resultPath, state);
      await maybeCaptureFailure(page, screenshotDir, 'issue-timeout.png');
      await context.close();
      process.exit(1);
    }

    const finalText = await page.locator('body').innerText().catch(() => '');
    const finalPolicyNumber = detectPolicyNumber(finalText);
    if (!finalPolicyNumber) {
      state.status = 'failed';
      state.step = 'completed';
      state.last_error = 'После ручного шага номер полиса не найден на странице.';
      state.finished_at = nowIso();
      appendLog(state, state.last_error, 'completed', 'error');
      writeJson(resultPath, state);
      await maybeCaptureFailure(page, screenshotDir, 'policy-number-missing.png');
      await context.close();
      process.exit(1);
    }

    state.status = 'succeeded';
    state.step = 'completed';
    state.external_policy_number = finalPolicyNumber;
    state.finished_at = nowIso();
    appendLog(state, `Получен номер полиса ${finalPolicyNumber}.`, 'completed');
    writeJson(resultPath, state);
    await context.close();
    process.exit(0);
  } catch (error) {
    state.status = 'failed';
    state.finished_at = nowIso();
    state.last_error = sanitizeError(error);
    appendLog(state, state.last_error, state.step || 'runner', 'error');
    writeJson(resultPath, state);
    if (context && context.pages && context.pages()[0]) {
      await maybeCaptureFailure(context.pages()[0], screenshotDir, 'runner-error.png');
      await context.close().catch(() => undefined);
    }
    process.exit(1);
  }
}

main();
