import { expect, test, type Page } from '@playwright/test';

const emptyPage = { count: 0, next: null, previous: null, results: [] };

const authenticate = async (page: Page) => {
  await page.addInitScript(() => {
    const token = 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature';
    localStorage.setItem('jwt_access_token', token);
    localStorage.setItem('jwt_refresh_token', token);
  });
};

const mockEmptyWorkspace = async (page: Page) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me/')) {
      await route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'seller',
          is_authenticated: true,
          roles: ['Продавец'],
          capabilities: [
            'settings.profile',
            'settings.notifications',
            'settings.integrations',
            'settings.mail',
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: emptyPage });
  });
};

test('primary routes keep the standardized desktop page shell without global overflow', async ({
  page,
}) => {
  await authenticate(page);
  await mockEmptyWorkspace(page);

  const routes = [
    ['/seller-dashboard', 'Продажи по дате начала полиса'],
    ['/deals', 'Сделки'],
    ['/clients', 'Клиенты'],
    ['/policies', 'Полисы'],
    ['/commissions', 'Доходы и расходы'],
    ['/tasks', 'Задачи'],
    ['/settings', 'Настройки'],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    const hasGlobalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(hasGlobalOverflow, `${route} should not overflow the desktop viewport`).toBe(false);
  }
});

test('desktop seller workspace exposes five primary deal sections', async ({ page }) => {
  await page.addInitScript(() => {
    const token = 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature';
    localStorage.setItem('jwt_access_token', token);
    localStorage.setItem('jwt_refresh_token', token);
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me/')) {
      await route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'seller',
          is_authenticated: true,
          roles: ['Продавец'],
          capabilities: ['settings.profile'],
        },
      });
      return;
    }
    if (url.pathname.endsWith('/deals/')) {
      await route.fulfill({
        json: {
          ...emptyPage,
          count: 1,
          results: [
            {
              id: '00000000-0000-0000-0000-000000000010',
              title: 'Тестовая сделка',
              status: 'open',
              quotes: [],
            },
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: emptyPage });
  });

  await page.goto('/deals');

  await expect(page.getByText('Тестовая сделка').first()).toBeVisible();
  await page.getByText('Тестовая сделка').first().click();
  const primaryTabs = page.getByRole('tablist', { name: 'Основные разделы выбранной сделки' });
  await expect(primaryTabs.getByRole('tab')).toHaveCount(5);
  await expect(primaryTabs.getByRole('tab', { name: 'Обзор' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('login form has a usable keyboard order at desktop size', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Имя пользователя').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Пароль')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Войти' })).toBeFocused();
});

test('finance defaults to all records and processing preset is shareable', async ({ page }) => {
  await page.addInitScript(() => {
    const token = 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature';
    localStorage.setItem('jwt_access_token', token);
    localStorage.setItem('jwt_refresh_token', token);
  });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me/')) {
      await route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'seller',
          is_authenticated: true,
          roles: ['Продавец'],
        },
      });
      return;
    }
    if (url.pathname.endsWith('/financial_records/summary/')) {
      await route.fulfill({
        json: {
          records_count: 0,
          income_total: '0.00',
          expense_total: '0.00',
          net_total: '0.00',
          unpaid_records_count: 0,
          without_statement_count: 0,
          payments_paid_balance_total: '0.00',
        },
      });
      return;
    }
    await route.fulfill({ json: emptyPage });
  });

  await page.goto('/commissions?financeView=all');

  await expect(page.getByText('Активных фильтров:')).toHaveCount(0);
  await expect(page.getByLabel('Показывать неоплаченные платежи')).toBeChecked();
  await expect(page.getByLabel('Показывать записи в ведомостях')).toBeChecked();
  await expect(page.getByLabel('Показать оплаченные расходы/доходы')).toBeChecked();
  await expect(page.getByLabel('Показывать нулевое сальдо')).toBeChecked();

  await page.getByRole('button', { name: 'К обработке' }).click();
  await expect(page).toHaveURL(/fr_show_unpaid_payments=0/);
  await expect(page).toHaveURL(/fr_show_statement_records=0/);
  await expect(page).toHaveURL(/fr_show_paid_records=0/);
  await expect(page).toHaveURL(/fr_show_zero_saldo=0/);
});
