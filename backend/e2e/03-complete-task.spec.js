import { test, expect } from '@playwright/test';

test('marks a task done', async ({ request }) => {
  const created = await request.post('/api/tasks', {
    data: { title: 'Finish this task' },
  });
  const { data: task } = await created.json();

  expect(created.status()).toBe(201);

  const updated = await request.patch(`/api/tasks/${task.id}`, {
    data: { completed: true },
  });
  const updatedBody = await updated.json();

  expect(updated.status()).toBe(200);
  expect(updatedBody.data.completed).toBe(true);
  expect(updatedBody.data.completedAt).toBeTruthy();
});
