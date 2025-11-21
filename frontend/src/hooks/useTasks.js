import { useState, useCallback, useEffect } from 'react';
import { tasksApi } from '@/services/api';

export function useTasks(initialFilters = {}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(initialFilters);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tasksApi.list(filters);
      setTasks(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(async (taskData) => {
    const response = await tasksApi.create(taskData);
    setTasks(prev => [response.data, ...prev]);
    return response.data;
  }, []);

  const updateTask = useCallback(async (id, updates) => {
    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, ...updates } : t
    ));

    try {
      const response = await tasksApi.update(id, updates);
      setTasks(prev => prev.map(t => 
        t.id === id ? response.data : t
      ));
      return response.data;
    } catch (err) {
      fetchTasks(); // Revert on error
      throw err;
    }
  }, [fetchTasks]);

  const deleteTask = useCallback(async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    
    try {
      await tasksApi.delete(id);
    } catch (err) {
      fetchTasks();
      throw err;
    }
  }, [fetchTasks]);

  const toggleComplete = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      return updateTask(id, { completed: !task.completed });
    }
  }, [tasks, updateTask]);

  const bulkAction = useCallback(async (action, ids) => {
    if (action === 'delete') {
      setTasks(prev => prev.filter(t => !ids.includes(t.id)));
    } else if (action === 'complete') {
      setTasks(prev => prev.map(t => 
        ids.includes(t.id) ? { ...t, completed: true } : t
      ));
    }

    try {
      await tasksApi.bulk(action, ids);
    } catch (err) {
      fetchTasks();
      throw err;
    }
  }, [fetchTasks]);

  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  return {
    tasks,
    loading,
    error,
    filters,
    createTask,
    updateTask,
    deleteTask,
    toggleComplete,
    bulkAction,
    updateFilters,
    refresh: fetchTasks,
  };
}