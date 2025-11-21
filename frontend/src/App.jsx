import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search, Plus, Check, Trash2, Archive, Clock, Calendar,
  ChevronDown, Moon, Sun, BarChart3, CheckCircle2, AlertCircle,
  Flame, Zap, Circle, X, Briefcase, User, Folder, Tag, ArchiveRestore
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const PRIORITY_CONFIG = {
  high: { label: "Alta", color: "text-rose-400", bg: "bg-rose-500/20", border: "border-rose-500/30", icon: Flame },
  medium: { label: "Média", color: "text-amber-400", bg: "bg-amber-500/20", border: "border-amber-500/30", icon: Zap },
  low: { label: "Baixa", color: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30", icon: Circle }
};

const CATEGORIES = [
  { id: "all", name: "Todas", color: "#8b5cf6", icon: Folder },
  { id: "default", name: "Geral", color: "#6366f1", icon: Folder },
  { id: "work", name: "Trabalho", color: "#f59e0b", icon: Briefcase },
  { id: "personal", name: "Pessoal", color: "#10b981", icon: User }
];

const INITIAL_TASK = {
  title: "",
  description: "",
  priority: "medium",
  category: "default",
  dueDate: "",
  tags: ""
};

async function api(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  if (!response.ok && response.status !== 204) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Request failed");
  }
  
  return response.status === 204 ? null : response.json();
}

function PriorityBadge({ priority }) {
  const config = PRIORITY_CONFIG[priority];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${config.bg} ${config.color} ${config.border} border`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, gradient }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function TaskItem({ task, onToggle, onDelete, onExpand, isExpanded, onToggleSubtask }) {
  const category = CATEGORIES.find(c => c.id === task.category) || CATEGORIES[1];
  const CategoryIcon = category.icon;
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div className={`bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 ${task.completed ? "opacity-60" : ""}`}>
      <div className="p-4 flex items-center gap-3">
        <button
          onClick={() => onToggle(task.id)}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0
            ${task.completed 
              ? "bg-emerald-500 border-emerald-500" 
              : `${PRIORITY_CONFIG[task.priority].border} hover:bg-slate-800`}`}
        >
          {task.completed && <Check size={14} className="text-white" />}
        </button>

        <button onClick={() => onExpand(task.id)} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-medium truncate ${task.completed ? "line-through text-slate-500" : ""}`}>
              {task.title}
            </span>
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
            <span style={{ color: category.color }} className="flex items-center gap-1">
              <CategoryIcon size={12} />
              {category.name}
            </span>
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(task.dueDate).toLocaleDateString("pt-BR")}
              </span>
            )}
            {totalSubtasks > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 size={12} />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1 flex-shrink-0">
          {task.tags?.slice(0, 2).map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-md text-xs bg-slate-800 text-slate-400">
              {tag}
            </span>
          ))}
          <button
            onClick={() => onDelete(task.id)}
            className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 size={16} />
          </button>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-800">
          {task.description && (
            <p className="text-sm text-slate-400 mb-3">{task.description}</p>
          )}
          {totalSubtasks > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300 mb-2">Subtarefas</p>
              {task.subtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleSubtask(task.id, sub.id, !sub.completed)}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all
                      ${sub.completed ? "bg-emerald-500 border-emerald-500" : "border-slate-600 hover:border-slate-500"}`}
                  >
                    {sub.completed && <Check size={10} className="text-white" />}
                  </button>
                  <span className={`text-sm ${sub.completed ? "line-through text-slate-500" : "text-slate-300"}`}>
                    {sub.title}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-500">
            <span>Criada em {new Date(task.createdAt).toLocaleDateString("pt-BR")}</span>
            {task.completedAt && (
              <span>Concluída em {new Date(task.completedAt).toLocaleDateString("pt-BR")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddTaskModal({ isOpen, onClose, onAdd }) {
  const [formData, setFormData] = useState(INITIAL_TASK);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;
    
    setLoading(true);
    try {
      await onAdd({
        ...formData,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean)
      });
      setFormData(INITIAL_TASK);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 animate-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Nova Tarefa</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Título da tarefa"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-violet-500 transition-colors"
            autoFocus
          />

          <textarea
            placeholder="Descrição (opcional)"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-violet-500 transition-colors resize-none h-20"
          />

          <div className="grid grid-cols-2 gap-3">
            <select
              value={formData.priority}
              onChange={e => setFormData({ ...formData, priority: e.target.value })}
              className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-violet-500"
            >
              <option value="high">Alta Prioridade</option>
              <option value="medium">Média Prioridade</option>
              <option value="low">Baixa Prioridade</option>
            </select>

            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-violet-500"
            >
              {CATEGORIES.slice(1).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <input
            type="date"
            value={formData.dueDate}
            onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-violet-500"
          />

          <input
            type="text"
            placeholder="Tags (separadas por vírgula)"
            value={formData.tags}
            onChange={e => setFormData({ ...formData, tags: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 outline-none focus:border-violet-500"
          />

          <button
            onClick={handleSubmit}
            disabled={loading || !formData.title.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-medium 
              hover:shadow-lg hover:shadow-violet-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Criando..." : "Criar Tarefa"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);
  const [expandedTask, setExpandedTask] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api("/api/tasks");
      setTasks(response.data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = tasks.filter(t => !t.completed).length;
    const highPriority = tasks.filter(t => t.priority === "high" && !t.completed).length;
    return {
      total,
      completed,
      pending,
      highPriority,
      rate: total ? Math.round((completed / total) * 100) : 0
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => selectedCategory === "all" || t.category === selectedCategory)
      .filter(t => showCompleted || !t.completed)
      .filter(t => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.toLowerCase().includes(q))
        );
      });
  }, [tasks, selectedCategory, showCompleted, searchQuery]);

  const handleToggleComplete = async (id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    setTasks(prev => prev.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    ));

    try {
      await api(`/api/tasks/${id}`, {
        method: "PATCH",
        body: { completed: !task.completed }
      });
    } catch {
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, completed: task.completed } : t
      ));
    }
  };

  const handleDelete = async (id) => {
    const previousTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));
    setExpandedTask(prev => prev === id ? null : prev);

    try {
      await api(`/api/tasks/${id}`, { method: "DELETE" });
    } catch {
      setTasks(previousTasks);
    }
  };

  const handleAddTask = async (taskData) => {
    const response = await api("/api/tasks", {
      method: "POST",
      body: taskData
    });
    setTasks(prev => [response.data, ...prev]);
  };

  const handleToggleSubtask = async (taskId, subtaskId, completed) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t;
      return {
        ...t,
        subtasks: t.subtasks.map(s => 
          s.id === subtaskId ? { ...s, completed } : s
        )
      };
    }));

    try {
      await api(`/api/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: "PATCH",
        body: { completed }
      });
    } catch {
      fetchTasks();
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"}`}>
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <CheckCircle2 size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">TaskFlow</h1>
              <p className="text-xs text-slate-400">Gestão inteligente de tarefas</p>
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2.5 rounded-xl border transition-transform hover:scale-105 
              ${darkMode ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200"}`}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total" value={stats.total} icon={BarChart3} gradient="from-violet-500 to-purple-600" />
          <StatCard label="Concluídas" value={stats.completed} icon={CheckCircle2} gradient="from-emerald-500 to-teal-600" />
          <StatCard label="Pendentes" value={stats.pending} icon={Clock} gradient="from-amber-500 to-orange-600" />
          <StatCard label="Urgentes" value={stats.highPriority} icon={AlertCircle} gradient="from-rose-500 to-pink-600" />
        </div>

        {/* Progress */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">Progresso Geral</span>
            <span className="text-sm font-bold">{stats.rate}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${stats.rate}%` }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className={`flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border 
            ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-300"}`}>
            <Search size={18} className="text-slate-400" />
            <input
              type="text"
              placeholder="Buscar tarefas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-300">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className={`px-4 py-2.5 rounded-xl border text-sm outline-none
                ${darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-300"}`}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>

            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors
                ${showCompleted 
                  ? "bg-violet-500/20 border-violet-500/30 text-violet-400" 
                  : darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-300"}`}
            >
              {showCompleted ? "Todas" : "Pendentes"}
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-medium 
                flex items-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 transition-shadow"
            >
              <Plus size={18} />
              Nova
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="space-y-2">
          {loading ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-400">Carregando tarefas...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-slate-600" />
              </div>
              <p className="font-medium text-slate-400">
                {searchQuery ? "Nenhuma tarefa encontrada" : "Nenhuma tarefa ainda"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="mt-4 text-sm text-violet-400 hover:text-violet-300"
                >
                  Criar primeira tarefa
                </button>
              )}
            </div>
          ) : (
            filteredTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={handleToggleComplete}
                onDelete={handleDelete}
                onExpand={id => setExpandedTask(expandedTask === id ? null : id)}
                isExpanded={expandedTask === task.id}
                onToggleSubtask={handleToggleSubtask}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            TaskFlow • {tasks.length} tarefas • {stats.completed} concluídas
          </p>
        </footer>
      </div>

      <AddTaskModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddTask}
      />
    </div>
  );
}