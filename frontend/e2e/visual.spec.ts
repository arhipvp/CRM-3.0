import { expect, test, type Page } from '@playwright/test';

const emptyPage = { count: 0, next: null, previous: null, results: [] };

async function authenticate(page: Page) {
  await page.addInitScript(() => {
    const token = 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature';
    localStorage.setItem('jwt_access_token', token);
    localStorage.setItem('jwt_refresh_token', token);
    localStorage.setItem('crm.sidebar.collapsed', 'false');
  });
}

async function mockWorkspace(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me/')) {
      await route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'visual-seller',
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
}

async function mockActionIconsWorkspace(page: Page) {
  const clientId = '00000000-0000-0000-0000-000000000101';

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me/')) {
      await route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'visual-seller',
          is_authenticated: true,
          roles: ['Продавец'],
          capabilities: ['settings.profile'],
        },
      });
      return;
    }
    if (url.pathname.endsWith('/clients/duplicate-hints/')) {
      await route.fulfill({
        json: {
          results: {
            [clientId]: {
              client_id: clientId,
              candidate_count: 2,
              max_score: 91,
              confidence: 'high',
              reasons: ['Похожее ФИО'],
              needs_name_normalization: true,
              normalized_name: 'Соколова Тамара Андреевна',
            },
          },
        },
      });
      return;
    }
    if (url.pathname.endsWith('/clients/stats/')) {
      await route.fulfill({ json: { total: 1, created_last_30_days: 1 } });
      return;
    }
    if (url.pathname.endsWith('/clients/')) {
      await route.fulfill({
        json: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: clientId,
              name: 'СОКОЛОВА ТАМАРА АНДРЕЕВНА',
              phone: '+79990000000',
              created_at: '2026-08-01T10:00:00Z',
              updated_at: '2026-08-01T10:00:00Z',
              deal_count: 1,
            },
          ],
        },
      });
      return;
    }
    if (url.pathname.endsWith('/tasks/')) {
      await route.fulfill({
        json: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: '00000000-0000-0000-0000-000000000201',
              title: 'Проверить документы клиента',
              description: 'Задача завершена для visual-проверки.',
              client_name: 'Соколова Тамара Андреевна',
              created_by_name: 'Vova',
              assignee_name: 'Alisa',
              status: 'done',
              priority: 'normal',
              due_at: null,
              checklist: [],
              checklist_count: 0,
              created_at: '2026-08-01T10:00:00Z',
              completed_at: '2026-08-02T12:00:00Z',
              completed_by_name: 'Alisa',
              completion_comment: 'Готово',
            },
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: emptyPage });
  });
}

async function mockDealsIconWorkspace(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/auth/me/')) {
      await route.fulfill({
        json: {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'visual-seller',
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
          count: 2,
          next: null,
          previous: null,
          results: [
            {
              id: '00000000-0000-0000-0000-000000000010',
              title: 'Закреплённая сделка',
              client: '00000000-0000-0000-0000-000000000101',
              client_name: 'Калитинова Виктория Александровна',
              client_active_deals_count: 2,
              seller: '00000000-0000-0000-0000-000000000001',
              executor_name: 'Иван Петров',
              status: 'open',
              is_pinned: true,
              quotes: [],
            },
            {
              id: '00000000-0000-0000-0000-000000000011',
              title: 'Новая сделка',
              client: '00000000-0000-0000-0000-000000000102',
              client_name: 'Синицин Дмитрий Алексеевич',
              client_active_deals_count: 1,
              seller: '00000000-0000-0000-0000-000000000001',
              executor_name: 'Анна Смирнова',
              status: 'open',
              is_pinned: false,
              quotes: [],
            },
          ],
        },
      });
      return;
    }
    await route.fulfill({ json: emptyPage });
  });
}

test('login page visual baseline', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Insure Desk' })).toBeVisible();
  await expect(page).toHaveScreenshot('login.png', { fullPage: true });
});

test('empty primary routes visual baselines', async ({ page }) => {
  await authenticate(page);
  await mockWorkspace(page);

  const routes = [
    ['deals', '/deals', 'Сделки'],
    ['dashboard', '/seller-dashboard', 'Продажи по дате начала полиса'],
    ['policies', '/policies', 'Полисы'],
    ['commissions', '/commissions?financeView=all', 'Доходы и расходы'],
    ['settings', '/settings', 'Настройки'],
  ] as const;

  for (const [name, route, heading] of routes) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}-empty.png`, { fullPage: true });
  }
});

test('deal pin actions and client counters visual baseline', async ({ page }) => {
  await authenticate(page);
  await mockDealsIconWorkspace(page);
  await page.goto('/deals');

  await expect(page.getByText('Закреплённая сделка').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Открепить сделку' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Закрепить сделку' })).toBeVisible();
  await expect(page).toHaveScreenshot('deals-icons.png', { fullPage: true });
});

test('client indicators and completed task visual baselines', async ({ page }) => {
  await authenticate(page);
  await mockActionIconsWorkspace(page);

  await page.goto('/clients');
  await expect(page.getByRole('button', { name: /Нормализовать ФИО клиента/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Показать возможные дубли клиента/ }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot('clients-action-icons.png', { fullPage: true });

  await page.goto('/tasks?show_completed=true');
  await expect(page.getByText('Проверить документы клиента')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Завершена', exact: true })).toBeVisible();
  await expect(page).toHaveScreenshot('tasks-action-icons.png', { fullPage: true });
});

test('dev UI catalog and modal visual baselines', async ({ page }) => {
  await authenticate(page);
  await mockWorkspace(page);
  await page.goto('/dev/ui-kit');
  await expect(page.getByTestId('ui-catalog')).toBeVisible();
  await expect(page).toHaveScreenshot('ui-catalog.png', { fullPage: true });

  await page.getByRole('button', { name: 'Открыть модальное окно' }).click();
  await expect(page.getByRole('dialog', { name: 'Пример модального окна' })).toBeVisible();
  await expect(page).toHaveScreenshot('ui-catalog-modal.png');
});
