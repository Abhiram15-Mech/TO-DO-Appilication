import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { config } from "./config.js";
import TaskCard from "./TaskCard.jsx";
import { applyTaskAction } from "./taskActions.js";
import { deadlineFromDateInput, isOverdue } from "./utils.js";

const { labels } = config;

const PANEL_TITLES = {
  all: "All tasks",
  pending: "Pending tasks",
  overdue: "Overdue tasks",
  completed: "Completed tasks",
};

export default function PersonalBoard({ onAuthError }) {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState("");
  const [deadline, setDeadline] = useState("");
  const [filter, setFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .getTasks()
      .then((data) => {
        if (!active) return;
        setTasks(data.tasks);
        setHistory(data.history);
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) onAuthError();
        else setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onAuthError]);

  function handleError(err) {
    if (err.status === 401) {
      onAuthError();
      return;
    }
    setError(err.message || "Something went wrong.");
  }

  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return history.filter((item) => new Date(item.completedAt).toDateString() === today).length;
  }, [history]);

  const pendingTasks = useMemo(
    () => tasks.filter((task) => !isOverdue(task.deadline)),
    [tasks]
  );
  const overdueTasks = useMemo(
    () => tasks.filter((task) => isOverdue(task.deadline)),
    [tasks]
  );

  const counts = {
    all: tasks.length + history.length,
    pending: pendingTasks.length,
    overdue: overdueTasks.length,
    completed: history.length,
  };

  const items = useMemo(() => {
    const asItems = (list, completed) => list.map((task) => ({ task, completed }));

    switch (filter) {
      case "pending":
        return asItems(pendingTasks, false);
      case "overdue":
        return asItems(overdueTasks, false);
      case "completed":
        return asItems(history, true);
      default:
        return [
          ...asItems(overdueTasks, false),
          ...asItems(pendingTasks, false),
          ...asItems(history, true),
        ];
    }
  }, [filter, pendingTasks, overdueTasks, history]);

  async function addTask(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    try {
      const { task } = await api.createTask(text, deadlineFromDateInput(deadline));
      setTasks((prev) => [task, ...prev]);
      setDraft("");
      setDeadline("");
      if (filter === "completed") setFilter("pending");
    } catch (err) {
      handleError(err);
    }
  }

  async function handleTaskAction(id, action) {
    const current = tasks.find((task) => task.id === id);
    if (!current) return;
    const next = applyTaskAction(current, action);
    setTasks((prev) => prev.map((task) => (task.id === id ? next : task)));

    try {
      const { task } = await api.updateTask(id, {
        progress: next.progress,
        steps: next.steps,
        comments: next.comments,
        deadline: next.deadline,
      });
      setTasks((prev) => prev.map((item) => (item.id === id ? task : item)));
    } catch (err) {
      setTasks((prev) => prev.map((item) => (item.id === id ? current : item)));
      handleError(err);
    }
  }

  async function completeTask(id) {
    try {
      const { task } = await api.updateTask(id, {
        completedAt: new Date().toISOString(),
      });
      setTasks((prev) => prev.filter((item) => item.id !== id));
      setHistory((prev) => [task, ...prev]);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      handleError(err);
    }
  }

  async function reopenTask(id) {
    try {
      const { task } = await api.updateTask(id, { completedAt: null });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setTasks((prev) => [task, ...prev]);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      handleError(err);
    }
  }

  async function deleteTask(id) {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      handleError(err);
    }
  }

  async function deleteHistoryItem(id) {
    try {
      await api.deleteTask(id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      handleError(err);
    }
  }

  async function clearHistory() {
    try {
      await api.clearHistory();
      setHistory([]);
    } catch (err) {
      handleError(err);
    }
  }

  function toggleExpanded(id) {
    setExpandedId((current) => (current === id ? null : id));
  }

  const emptyState = {
    all: { title: "Nothing here yet", text: "Add your first task above to get started." },
    pending: { title: "No pending tasks", text: "You are all caught up." },
    overdue: { title: "No overdue tasks", text: "Every task is on schedule." },
    completed: { title: "No completed tasks yet", text: "Completed tasks will appear here." },
  }[filter];

  const filterTabs = [
    { id: "all", label: labels.all },
    { id: "pending", label: labels.pending },
    { id: "overdue", label: labels.overdue },
    { id: "completed", label: labels.completed },
  ];

  return (
    <div className="page-content">
      <header className="app-header">
        <div>
          <p className="eyebrow">Personal workspace</p>
          <h1>{config.appName}</h1>
        </div>
        <div className="stats">
          <div className="stat">
            <span className="stat-value">{tasks.length}</span>
            <span className="stat-label">{labels.toDo}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{completedToday}</span>
            <span className="stat-label">{labels.doneToday}</span>
          </div>
          <div className="stat">
            <span className="stat-value">{history.length}</span>
            <span className="stat-label">{labels.allTime}</span>
          </div>
        </div>
      </header>

      <form className="composer" onSubmit={addTask}>
        <input
          className="composer-input"
          type="text"
          placeholder={config.newTaskPlaceholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={config.maxTaskLength}
          aria-label="New task"
        />
        <input
          className="composer-deadline"
          type="date"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          title={config.deadlineLabel}
          aria-label={config.deadlineLabel}
        />
        <button className="btn btn-primary" type="submit" disabled={!draft.trim()}>
          {labels.addTask}
        </button>
      </form>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      <nav className="tabs" role="tablist">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${filter === tab.id ? "is-active" : ""}`}
            onClick={() => setFilter(tab.id)}
            role="tab"
            aria-selected={filter === tab.id}
          >
            {tab.label} <span className="pill">{counts[tab.id]}</span>
          </button>
        ))}
      </nav>

      <section className="panel" aria-label={PANEL_TITLES[filter]}>
        <div className="panel-head">
          <p className="panel-title">{PANEL_TITLES[filter]}</p>
          {(filter === "completed" || filter === "all") && history.length > 0 && (
            <button className="btn btn-ghost" onClick={clearHistory}>
              {labels.clearHistory}
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty">
            <p className="empty-text">Loading your tasks...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <p className="empty-title">{emptyState.title}</p>
            <p className="empty-text">{emptyState.text}</p>
          </div>
        ) : (
          <ul className="list">
            {items.map(({ task, completed }) => (
              <TaskCard
                key={task.id}
                task={task}
                completed={completed}
                expanded={expandedId === task.id}
                onToggleExpand={() => toggleExpanded(task.id)}
                onChange={
                  completed
                    ? undefined
                    : (action) => handleTaskAction(task.id, action)
                }
                onComplete={() => completeTask(task.id)}
                onReopen={completed ? () => reopenTask(task.id) : undefined}
                onDelete={() =>
                  completed ? deleteHistoryItem(task.id) : deleteTask(task.id)
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
