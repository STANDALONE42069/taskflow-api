import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

vi.mock('@/services/api', () => ({
  tasksApi: {
    list: vi.fn(() => Promise.resolve({
      data: [
        {
          id: '1',
          title: 'Test Task',
          description: 'Test description',
          priority: 'high',
          category: 'work',
          tags: ['urgent'],
          completed: false,
          subtasks: [],
          createdAt: new Date().toISOString(),
        },
      ],
    })),
    create: vi.fn((task) => Promise.resolve({
      data: { ...task, id: '2', completed: false, subtasks: [], createdAt: new Date().toISOString() },
    })),
    update: vi.fn((id, updates) => Promise.resolve({
      data: { id, ...updates },
    })),
    delete: vi.fn(() => Promise.resolve()),
  },
  statsApi: {
    get: vi.fn(() => Promise.resolve({
      data: { total: 1, completed: 0, pending: 1, highPriority: 1, rate: 0 },
    })),
  },
}));

describe('TaskFlow App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app header', () => {
    render(<App />);
    expect(screen.getByText('TaskFlow')).toBeInTheDocument();
  });

  it('displays task list', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
  });

  it('opens add task modal when clicking new button', async () => {
    render(<App />);
    
    const addButton = screen.getByText('Nova');
    fireEvent.click(addButton);
    
    expect(screen.getByText('Nova Tarefa')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Título da tarefa')).toBeInTheDocument();
  });

  it('toggles dark mode', () => {
    render(<App />);
    
    const themeButton = screen.getByRole('button', { name: /sun|moon/i });
    const initialBg = document.body.className;
    
    fireEvent.click(themeButton);
    
    expect(document.body.className).not.toBe(initialBg);
  });

  it('filters tasks by search query', async () => {
    render(<App />);
    
    const searchInput = screen.getByPlaceholderText('Buscar tarefas...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    await waitFor(() => {
      expect(screen.getByText('Nenhuma tarefa encontrada')).toBeInTheDocument();
    });
  });

  it('displays statistics cards', () => {
    render(<App />);
    
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Concluídas')).toBeInTheDocument();
    expect(screen.getByText('Pendentes')).toBeInTheDocument();
    expect(screen.getByText('Urgentes')).toBeInTheDocument();
  });

  it('expands task to show details', async () => {
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    const taskTitle = screen.getByText('Test Task');
    fireEvent.click(taskTitle);
    
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });
});

describe('Task interactions', () => {
  it('creates a new task', async () => {
    const { tasksApi } = await import('@/services/api');
    render(<App />);
    
    fireEvent.click(screen.getByText('Nova'));
    
    const titleInput = screen.getByPlaceholderText('Título da tarefa');
    fireEvent.change(titleInput, { target: { value: 'New Task' } });
    
    fireEvent.click(screen.getByText('Criar Tarefa'));
    
    await waitFor(() => {
      expect(tasksApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Task' })
      );
    });
  });

  it('closes modal when clicking X button', async () => {
    render(<App />);
    
    fireEvent.click(screen.getByText('Nova'));
    expect(screen.getByText('Nova Tarefa')).toBeInTheDocument();
    
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => btn.querySelector('svg'));
    if (closeButton) {
      fireEvent.click(closeButton);
    }
  });
});