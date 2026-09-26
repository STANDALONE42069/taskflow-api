import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { once } from 'node:events';
import app from '../src/index.js';

let apiUrl;
let server;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  apiUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function callApi(path, { method = 'GET', data } = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const body = response.status === 204 ? undefined : await response.json();
  return { response, body };
}

async function createTask(data) {
  const { response, body } = await callApi('/api/tasks', { method: 'POST', data });
  expect(response.status).toBe(201);
  return body.data;
}

beforeEach(async () => {
  const { body } = await callApi('/api/tasks');
  if (body.data.length) {
    await callApi('/api/tasks/bulk', {
      method: 'POST',
      data: { action: 'delete', ids: body.data.map(task => task.id) },
    });
  }
});

describe('coverage for Taskflow API quality gates', () => {
  it('reports empty statistics and the zero completion rate', async () => {
    const { response, body } = await callApi('/api/stats');

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      total: 0,
      completed: 0,
      pending: 0,
      archived: 0,
      overdue: 0,
      completionRate: 0,
    });
  });

  it('filters and searches tasks, then sorts incomplete tasks ahead of completed ones', async () => {
    const { body: categoryBody } = await callApi('/api/categories', {
      method: 'POST',
      data: { name: 'Coverage category' },
    });
    const completed = await createTask({ title: 'coverage completed', priority: 'high' });
    await callApi(`/api/tasks/${completed.id}`, {
      method: 'PATCH',
      data: { completed: true },
    });
    const high = await createTask({
      title: 'coverage alpha',
      priority: 'high',
      category: categoryBody.data.id,
      description: 'needle description',
      tags: ['needle tag'],
    });
    const low = await createTask({
      title: 'coverage beta',
      priority: 'low',
      description: 'other text',
      tags: ['other tag'],
    });
    await callApi('/api/tasks/bulk', {
      method: 'POST',
      data: { action: 'archive', ids: [low.id] },
    });

    const checks = [
      ['/api/tasks?category=' + categoryBody.data.id, high.id],
      ['/api/tasks?priority=high', completed.id],
      ['/api/tasks?archived=true', low.id],
      ['/api/tasks?completed=true', completed.id],
      ['/api/tasks?completed=false&archived=false', high.id],
      ['/api/tasks?search=alpha', high.id],
      ['/api/tasks?search=needle%20description', high.id],
      ['/api/tasks?search=needle%20tag', high.id],
    ];
    for (const [path, taskId] of checks) {
      const { body } = await callApi(path);
      expect(body.data.map(task => task.id)).toContain(taskId);
    }

    const { body } = await callApi('/api/tasks');
    expect(body.data[0].id).toBe(high.id);
    expect(body.data.at(-1).id).toBe(completed.id);
  });

  it('creates tasks with defaults and handles get, update, and delete not-found cases', async () => {
    const { response: invalid, body: invalidBody } = await callApi('/api/tasks', {
      method: 'POST',
      data: { title: '   ' },
    });
    expect(invalid.status).toBe(400);
    expect(invalidBody.error).toBe('Title is required');

    const task = await createTask({ title: 'Defaults task' });
    expect(task).toMatchObject({
      description: '', priority: 'medium', category: 'default', tags: [],
      dueDate: null, completed: false, archived: false, subtasks: [], completedAt: null,
    });

    const { response: found, body: foundBody } = await callApi(`/api/tasks/${task.id}`);
    expect(found.status).toBe(200);
    expect(foundBody.data.id).toBe(task.id);

    const { response: completed } = await callApi(`/api/tasks/${task.id}`, {
      method: 'PATCH', data: { completed: true },
    });
    expect(completed.status).toBe(200);
    const { body: resetBody } = await callApi(`/api/tasks/${task.id}`, {
      method: 'PATCH', data: { completed: false },
    });
    expect(resetBody.data.completedAt).toBeNull();

    const { response: getMissing } = await callApi('/api/tasks/missing');
    expect(getMissing.status).toBe(404);
    const { response: patchMissing } = await callApi('/api/tasks/missing', {
      method: 'PATCH', data: { title: 'missing' },
    });
    const { response: deleteMissing } = await callApi('/api/tasks/missing', { method: 'DELETE' });
    expect(patchMissing.status).toBe(404);
    expect(deleteMissing.status).toBe(404);

    const { response: deleted } = await callApi(`/api/tasks/${task.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
  });

  it('covers add, update, delete, validation, and missing-parent subtask paths', async () => {
    const { response: missingParent } = await callApi('/api/tasks/missing/subtasks', {
      method: 'POST', data: { title: 'subtask' },
    });
    expect(missingParent.status).toBe(404);

    const task = await createTask({ title: 'Parent task' });
    const { response: missingTitle } = await callApi(`/api/tasks/${task.id}/subtasks`, {
      method: 'POST', data: { title: ' ' },
    });
    expect(missingTitle.status).toBe(400);

    const { response: added, body: addedBody } = await callApi(`/api/tasks/${task.id}/subtasks`, {
      method: 'POST', data: { title: 'Child task' },
    });
    expect(added.status).toBe(201);
    const subtaskId = addedBody.data.id;

    const { response: missingPatchParent } = await callApi('/api/tasks/missing/subtasks/child', {
      method: 'PATCH', data: { completed: true },
    });
    const { response: missingPatchChild } = await callApi(`/api/tasks/${task.id}/subtasks/missing`, {
      method: 'PATCH', data: { completed: true },
    });
    expect(missingPatchParent.status).toBe(404);
    expect(missingPatchChild.status).toBe(404);

    const { response: updated, body: updatedBody } = await callApi(
      `/api/tasks/${task.id}/subtasks/${subtaskId}`,
      { method: 'PATCH', data: { completed: true } },
    );
    expect(updated.status).toBe(200);
    expect(updatedBody.data.completed).toBe(true);

    const { response: missingDeleteParent } = await callApi('/api/tasks/missing/subtasks/child', {
      method: 'DELETE',
    });
    const { response: missingDeleteChild } = await callApi(`/api/tasks/${task.id}/subtasks/missing`, {
      method: 'DELETE',
    });
    expect(missingDeleteParent.status).toBe(404);
    expect(missingDeleteChild.status).toBe(404);

    const { response: deleted } = await callApi(
      `/api/tasks/${task.id}/subtasks/${subtaskId}`,
      { method: 'DELETE' },
    );
    expect(deleted.status).toBe(204);
  });

  it('lists categories and validates category creation with default and custom appearance', async () => {
    const { response: invalid } = await callApi('/api/categories', {
      method: 'POST', data: { name: ' ' },
    });
    expect(invalid.status).toBe(400);

    const { response: created, body: createdBody } = await callApi('/api/categories', {
      method: 'POST', data: { name: 'Default category' },
    });
    expect(created.status).toBe(201);
    expect(createdBody.data).toMatchObject({ color: '#6366f1', icon: 'folder' });

    const { body: customBody } = await callApi('/api/categories', {
      method: 'POST', data: { name: 'Custom category', color: '#123456', icon: 'star' },
    });
    expect(customBody.data).toMatchObject({ color: '#123456', icon: 'star' });

    const { body: listBody } = await callApi('/api/categories');
    expect(listBody.data.map(category => category.id)).toContain(createdBody.data.id);
  });

  it('calculates completion, archived, overdue, and priority statistics', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const high = await createTask({ title: 'Overdue high', priority: 'high', dueDate: yesterday });
    const medium = await createTask({ title: 'Completed medium', priority: 'medium' });
    const low = await createTask({ title: 'Archived low', priority: 'low' });
    await callApi(`/api/tasks/${medium.id}`, { method: 'PATCH', data: { completed: true } });
    await callApi('/api/tasks/bulk', { method: 'POST', data: { action: 'archive', ids: [low.id] } });

    const { body } = await callApi('/api/stats');
    expect(body.data).toMatchObject({
      total: 3, completed: 1, pending: 1, archived: 1, overdue: 1,
      byPriority: { high: 1, medium: 0, low: 1 }, completionRate: 33,
    });
    expect(high.id).toBeTruthy();
  });

  it('validates bulk actions and handles every supported action and unknown IDs', async () => {
    const { response: invalid, body: invalidBody } = await callApi('/api/tasks/bulk', {
      method: 'POST', data: { action: 'complete', ids: [] },
    });
    expect(invalid.status).toBe(400);
    expect(invalidBody.error).toBe('No tasks specified');

    const task = await createTask({ title: 'Bulk task' });
    for (const action of ['complete', 'uncomplete', 'archive', 'unarchive']) {
      const { response, body } = await callApi('/api/tasks/bulk', {
        method: 'POST', data: { action, ids: [task.id, 'unknown-id'] },
      });
      expect(response.status).toBe(200);
      expect(body.affected).toBe(1);
    }
    const { body: unsupported } = await callApi('/api/tasks/bulk', {
      method: 'POST', data: { action: 'not-supported', ids: [task.id] },
    });
    expect(unsupported.affected).toBe(0);

    const { body: deleted } = await callApi('/api/tasks/bulk', {
      method: 'POST', data: { action: 'delete', ids: [task.id] },
    });
    expect(deleted.affected).toBe(1);
  });

  it('returns a handled server error for an invalid task payload', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { response } = await callApi('/api/tasks', {
      method: 'POST', data: { title: 42 },
    });
    expect(response.status).toBe(500);
  });

  it('returns a JSON 404 for an unknown endpoint', async () => {
    const { response, body } = await callApi('/api/unknown-endpoint');
    expect(response.status).toBe(404);
    expect(body.error).toBe('Endpoint not found');
  });
});
