import { describe, it, expect, beforeEach, beforeAll, afterAll } from '@jest/globals';
import { once } from 'node:events';
import app from '../src/index.js';

let API_URL;
let server;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  API_URL = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

describe('Tasks API', () => {
  describe('GET /api/tasks', () => {
    it('should return an array of tasks', async () => {
      const response = await fetch(`${API_URL}/api/tasks`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should filter tasks by priority', async () => {
      const response = await fetch(`${API_URL}/api/tasks?priority=high`);
      const body = await response.json();

      expect(response.status).toBe(200);
      body.data.forEach(task => {
        expect(task.priority).toBe('high');
      });
    });

    it('should filter tasks by completion status', async () => {
      const response = await fetch(`${API_URL}/api/tasks?completed=false`);
      const body = await response.json();

      expect(response.status).toBe(200);
      body.data.forEach(task => {
        expect(task.completed).toBe(false);
      });
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      const newTask = {
        title: 'Test Task',
        priority: 'high',
        category: 'work',
      };

      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });

      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.title).toBe(newTask.title);
      expect(body.data.priority).toBe(newTask.priority);
      expect(body.data.id).toBeDefined();
      expect(body.data.completed).toBe(false);
    });

    it('should return 400 when title is missing', async () => {
      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: 'low' }),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    let taskId;

    beforeEach(async () => {
      const response = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task to update' }),
      });
      const body = await response.json();
      taskId = body.data.id;
    });

    it('should update task fields', async () => {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated title' }),
      });

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.title).toBe('Updated title');
    });

    it('should toggle completion status', async () => {
      const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });

      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.completed).toBe(true);
      expect(body.data.completedAt).toBeDefined();
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task', async () => {
      const createResponse = await fetch(`${API_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Task to delete' }),
      });
      const { data } = await createResponse.json();

      const deleteResponse = await fetch(`${API_URL}/api/tasks/${data.id}`, {
        method: 'DELETE',
      });

      expect(deleteResponse.status).toBe(204);

      const getResponse = await fetch(`${API_URL}/api/tasks/${data.id}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await fetch(`${API_URL}/health`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.status).toBe('ok');
    });
  });
});
