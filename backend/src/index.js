import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory storage
const tasks = new Map();
const categories = new Map([
  ['default', { id: 'default', name: 'Geral', color: '#6366f1', icon: 'folder' }],
  ['work', { id: 'work', name: 'Trabalho', color: '#f59e0b', icon: 'briefcase' }],
  ['personal', { id: 'personal', name: 'Pessoal', color: '#10b981', icon: 'user' }],
]);

function createTask(data) {
  return {
    id: randomUUID(),
    title: data.title,
    description: data.description || '',
    priority: data.priority || 'medium',
    category: data.category || 'default',
    tags: data.tags || [],
    dueDate: data.dueDate || null,
    completed: false,
    archived: false,
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };
}

function sortTasks(taskList) {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return taskList.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

// Health check
app.get('/health', (_, res) => {
  res.status(503).json({ status: 'broken-demo', timestamp: Date.now() });
});

// List tasks with filters
app.get('/api/tasks', (req, res) => {
  const { category, priority, completed, archived, search } = req.query;
  let result = Array.from(tasks.values());

  if (category) {
    result = result.filter(t => t.category === category);
  }
  if (priority) {
    result = result.filter(t => t.priority === priority);
  }
  if (completed !== undefined) {
    result = result.filter(t => t.completed === (completed === 'true'));
  }
  if (archived !== undefined) {
    result = result.filter(t => t.archived === (archived === 'true'));
  }
  if (search) {
    const term = search.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term) ||
      t.tags.some(tag => tag.toLowerCase().includes(term)),
    );
  }

  res.json({ data: sortTasks(result), total: result.length });
});

// Get single task
app.get('/api/tasks/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json({ data: task });
});

// Create task
app.post('/api/tasks', (req, res) => {
  if (!req.body.title?.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const task = createTask(req.body);
  tasks.set(task.id, task);
  res.status(201).json({ data: task });
});

// Update task
app.patch('/api/tasks/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const updates = { ...req.body, updatedAt: new Date().toISOString() };
  
  if (updates.completed === true && !task.completed) {
    updates.completedAt = new Date().toISOString();
  } else if (updates.completed === false) {
    updates.completedAt = null;
  }

  const updated = { ...task, ...updates };
  tasks.set(task.id, updated);
  res.json({ data: updated });
});

// Delete task
app.delete('/api/tasks/:id', (req, res) => {
  if (!tasks.has(req.params.id)) {
    return res.status(404).json({ error: 'Task not found' });
  }
  tasks.delete(req.params.id);
  res.status(204).send();
});

// Add subtask
app.post('/api/tasks/:id/subtasks', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!req.body.title?.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const subtask = {
    id: randomUUID(),
    title: req.body.title,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  task.subtasks.push(subtask);
  task.updatedAt = new Date().toISOString();
  res.status(201).json({ data: subtask });
});

// Update subtask
app.patch('/api/tasks/:taskId/subtasks/:subtaskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const subtask = task.subtasks.find(s => s.id === req.params.subtaskId);
  if (!subtask) {
    return res.status(404).json({ error: 'Subtask not found' });
  }

  Object.assign(subtask, req.body);
  task.updatedAt = new Date().toISOString();
  res.json({ data: subtask });
});

// Delete subtask
app.delete('/api/tasks/:taskId/subtasks/:subtaskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const index = task.subtasks.findIndex(s => s.id === req.params.subtaskId);
  if (index === -1) {
    return res.status(404).json({ error: 'Subtask not found' });
  }

  task.subtasks.splice(index, 1);
  task.updatedAt = new Date().toISOString();
  res.status(204).send();
});

// List categories
app.get('/api/categories', (_, res) => {
  res.json({ data: Array.from(categories.values()) });
});

// Create category
app.post('/api/categories', (req, res) => {
  if (!req.body.name?.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const category = {
    id: randomUUID(),
    name: req.body.name,
    color: req.body.color || '#6366f1',
    icon: req.body.icon || 'folder',
  };
  
  categories.set(category.id, category);
  res.status(201).json({ data: category });
});

// Statistics endpoint
app.get('/api/stats', (_, res) => {
  const allTasks = Array.from(tasks.values());
  const today = new Date().toISOString().split('T')[0];

  const completed = allTasks.filter(t => t.completed).length;
  const total = allTasks.length;

  res.json({
    data: {
      total,
      completed,
      pending: allTasks.filter(t => !t.completed && !t.archived).length,
      archived: allTasks.filter(t => t.archived).length,
      overdue: allTasks.filter(t => !t.completed && t.dueDate && t.dueDate < today).length,
      byPriority: {
        high: allTasks.filter(t => t.priority === 'high' && !t.completed).length,
        medium: allTasks.filter(t => t.priority === 'medium' && !t.completed).length,
        low: allTasks.filter(t => t.priority === 'low' && !t.completed).length,
      },
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    },
  });
});

// Bulk operations
app.post('/api/tasks/bulk', (req, res) => {
  const { action, ids } = req.body;
  
  if (!ids?.length) {
    return res.status(400).json({ error: 'No tasks specified' });
  }

  let affected = 0;
  const timestamp = new Date().toISOString();

  ids.forEach(id => {
    const task = tasks.get(id);
    if (!task) return;

    switch (action) {
      case 'complete':
        task.completed = true;
        task.completedAt = timestamp;
        task.updatedAt = timestamp;
        affected++;
        break;
      case 'uncomplete':
        task.completed = false;
        task.completedAt = null;
        task.updatedAt = timestamp;
        affected++;
        break;
      case 'archive':
        task.archived = true;
        task.updatedAt = timestamp;
        affected++;
        break;
      case 'unarchive':
        task.archived = false;
        task.updatedAt = timestamp;
        affected++;
        break;
      case 'delete':
        tasks.delete(id);
        affected++;
        break;
    }
  });

  res.json({ affected });
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Tests import the app and create their own server on an available port.
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`TaskFlow API running on http://localhost:${PORT}`);
  });
}

export default app;
