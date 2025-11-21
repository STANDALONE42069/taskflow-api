const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.error || 'An error occurred',
      response.status,
      data
    );
  }

  return data;
}

export const tasksApi = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/api/tasks${query ? `?${query}` : ''}`);
  },

  get: (id) => request(`/api/tasks/${id}`),

  create: (task) => request('/api/tasks', {
    method: 'POST',
    body: task,
  }),

  update: (id, updates) => request(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: updates,
  }),

  delete: (id) => request(`/api/tasks/${id}`, {
    method: 'DELETE',
  }),

  bulk: (action, ids) => request('/api/tasks/bulk', {
    method: 'POST',
    body: { action, ids },
  }),

  addSubtask: (taskId, subtask) => request(`/api/tasks/${taskId}/subtasks`, {
    method: 'POST',
    body: subtask,
  }),

  updateSubtask: (taskId, subtaskId, updates) => 
    request(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: 'PATCH',
      body: updates,
    }),
};

export const categoriesApi = {
  list: () => request('/api/categories'),
  
  create: (category) => request('/api/categories', {
    method: 'POST',
    body: category,
  }),
};

export const statsApi = {
  get: () => request('/api/stats'),
};

export { ApiError };