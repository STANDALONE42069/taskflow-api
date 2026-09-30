import { test, expect } from '@playwright/test';

test('lists tasks from a fresh API', async ({ request }) => {
  const response = await request.get('/api/tasks');
  const body = await response.json();

  expect(response.status()).toBe(200);
  expect(body).toMatchObject({ data: [], total: 0 });
});
