import { expect, test } from '@playwright/test';

const emptyPage = { count: 0, next: null, previous: null, results: [] };

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
