import { expect, test } from '@playwright/test';

test.use({ channel: 'chrome' });

test('data and request forms remain usable on a narrow screen with keyboard tabs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('jwt_access_token', 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature');
    localStorage.setItem('jwt_refresh_token', 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature');
    localStorage.setItem('crm.sidebar.collapsed', 'true');
  });
  const deal = {
    id: '00000000-0000-0000-0000-000000000010',
    title: 'Тестовая заявка',
    status: 'open',
    quotes: [],
    client: null,
    seller: 'user',
  };
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const list = (results: unknown[]) => ({
      count: results.length,
      next: null,
      previous: null,
      results,
    });
    if (path.endsWith('/auth/me/'))
      return route.fulfill({
        json: {
          id: 'user',
          username: 'tester',
          is_authenticated: true,
          roles: ['Администратор'],
          capabilities: [],
        },
      });
    if (path.endsWith('/deals/')) return route.fulfill({ json: list([deal]) });
    if (path.endsWith(`/deals/${deal.id}/`)) return route.fulfill({ json: deal });
    if (path.endsWith('/insurance_types/'))
      return route.fulfill({ json: list([{ id: 'casco', name: 'КАСКО' }]) });
    return route.fulfill({ json: list([]) });
  });
  await page.goto('/deals');
  await page.getByText('Тестовая заявка', { exact: true }).first().click();
  await page.getByRole('tab', { name: 'Данные', exact: true }).click();
  const people = page.getByRole('tab', { name: 'Люди', exact: true });
  await expect(people).toBeVisible();
  await people.focus();
  await people.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Машины', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByLabel('Название', { exact: false })).toBeVisible();
  await page.getByRole('tab', { name: 'Заявки', exact: true }).click();
  await page.getByRole('button', { name: 'Создать заявку', exact: true }).click();
  await expect(page.getByLabel('Название заявки')).toBeVisible();
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Новая заявка' }) });
  const overflow = await form.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: 'test-results/insurance-data-mobile.png', fullPage: true });
});
