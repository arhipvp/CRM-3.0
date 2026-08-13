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
