import { test, expect } from '@playwright/test';

test('creates and lists a task', async ({ request }) => {
  const created = await request.post('/api/tasks', {
    data: { title: 'Playwright task', priority: 'high' },
  });
  const createdBody = await created.json();

  expect(created.status()).toBe(201);
  expect(createdBody.data.title).toBe('Playwright task');

  const listed = await request.get('/api/tasks');
  const listedBody = await listed.json();
  expect(listedBody.data).toContainEqual(expect.objectContaining({
    id: createdBody.data.id,
    title: 'Playwright task',
  }));
});
