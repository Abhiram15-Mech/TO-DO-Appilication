import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { config } from "./config.js";
import TaskCard from "./TaskCard.jsx";
import { applyTaskAction } from "./taskActions.js";
import { deadlineFromDateInput, isOverdue } from "./utils.js";

const { labels } = config;

const PANEL_TITLES = {
  all: "All team tasks",
  pending: "Pending team tasks",
  overdue: "Overdue team tasks",
  completed: "Completed team tasks",
};

export default function TeamBoard({ user, teamId, onAuthError }) {
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [draft, setDraft] = useState("");
  const [deadline, setDeadline] = useState("");
  const [filter, setFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNotice, setInviteNotice] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([api.getTeam(teamId), api.getTeamTasks(teamId)])
      .then(([detail, data]) => {
        if (!active) return;
        setTeam(detail.team);
        setMembers(detail.members);
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
  }, [teamId, onAuthError]);

  function handleError(err) {
    if (err.status === 401) {
      onAuthError();
      return;
    }
    setError(err.message || "Something went wrong.");
  }

  function replaceTask(updated) {
    setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
    setHistory((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
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

  const isTeamOwner = team?.ownerId === user.id;

  async function addTask(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    try {
      const { task } = await api.createTeamTask(
        teamId,
        text,
        deadlineFromDateInput(deadline)
      );
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
      const { task } = await api.updateTeamTask(teamId, id, {
        progress: next.progress,
        steps: next.steps,
        comments: next.comments,
        deadline: next.deadline,
      });
      replaceTask(task);
    } catch (err) {
      setTasks((prev) => prev.map((item) => (item.id === id ? current : item)));
      handleError(err);
    }
  }

  async function addComment(taskId, text) {
    try {
      const { task } = await api.addTeamComment(teamId, taskId, text);
      replaceTask(task);
    } catch (err) {
      handleError(err);
    }
  }

  async function completeTask(id) {
    try {
      const { task } = await api.updateTeamTask(teamId, id, {
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
      const { task } = await api.updateTeamTask(teamId, id, { completedAt: null });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setTasks((prev) => [task, ...prev]);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      handleError(err);
    }
  }

  async function deleteTask(id) {
    try {
      await api.deleteTeamTask(teamId, id);
      setTasks((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      handleError(err);
    }
  }

  async function deleteHistoryItem(id) {
    try {
      await api.deleteTeamTask(teamId, id);
      setHistory((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      handleError(err);
    }
  }

  async function clearHistory() {
    try {
      await api.clearTeamHistory(teamId);
      setHistory([]);
    } catch (err) {
      handleError(err);
    }
  }

  async function inviteMember(event) {
    event.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setError("");
    try {
      const result = await api.inviteToTeam(teamId, email);
      setInviteEmail("");
      setInviteNotice(
        result.emailSent
          ? `Invitation email sent to ${email}.`
          : `Invitation created for ${email}. They will see it in-app when they sign in.`
      );
    } catch (err) {
      handleError(err);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(team.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  function toggleExpanded(id) {
    setExpandedId((current) => (current === id ? null : id));
  }

  const emptyState = {
    all: { title: "No team tasks yet", text: "Add the first task for this team above." },
    pending: { title: "No pending team tasks", text: "Everything in this team is caught up." },
    overdue: { title: "No overdue team tasks", text: "This team is on schedule." },
    completed: { title: "No completed team tasks", text: "Completed team tasks will appear here." },
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
          <p className="eyebrow">Team workspace</p>
          <h1>{team ? team.name : "Team"}</h1>
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
            <span className="stat-value">{members.length}</span>
            <span className="stat-label">Members</span>
          </div>
        </div>
      </header>

      {team && (
        <div className="team-info">
          <div className="team-info-row">
            <span className="team-info-label">Invite code</span>
            <code className="invite-code">{team.inviteCode}</code>
            <button className="btn btn-ghost" type="button" onClick={copyCode}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="member-chips">
            {members.map((member) => (
              <span
                key={member.id}
                className={`member-chip ${member.id === user.id ? "is-you" : ""}`}
              >
                {member.email}
                {member.role === "owner" ? " (host)" : ""}
                {member.id === user.id ? " (you)" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {isTeamOwner && (
        <form className="invite-form" onSubmit={inviteMember}>
          <input
            className="inline-input"
            type="email"
            placeholder="Invite a teammate by email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            aria-label="Invite a teammate by email"
          />
          <button className="btn btn-small" type="submit" disabled={!inviteEmail.trim()}>
            Send invite
          </button>
        </form>
      )}

      {inviteNotice && <p className="info-note">{inviteNotice}</p>}

      <form className="composer" onSubmit={addTask}>
        <input
          className="composer-input"
          type="text"
          placeholder="Add a task for this team..."
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={config.maxTaskLength}
          aria-label="New team task"
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
          {isTeamOwner && (filter === "completed" || filter === "all") && history.length > 0 && (
            <button className="btn btn-ghost" onClick={clearHistory}>
              {labels.clearHistory}
            </button>
          )}
        </div>

        {loading ? (
          <div className="empty">
            <p className="empty-text">Loading team tasks...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="empty">
            <p className="empty-title">{emptyState.title}</p>
            <p className="empty-text">{emptyState.text}</p>
          </div>
        ) : (
          <ul className="list">
            {items.map(({ task, completed }) => {
              const taskOwner = task.ownerId === user.id;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  completed={completed}
                  expanded={expandedId === task.id}
                  ownerEmail={task.ownerEmail}
                  onToggleExpand={() => toggleExpanded(task.id)}
                  onChange={
                    !completed && taskOwner
                      ? (action) => handleTaskAction(task.id, action)
                      : undefined
                  }
                  onComment={
                    !completed && !taskOwner
                      ? (text) => addComment(task.id, text)
                      : undefined
                  }
                  onComplete={
                    !completed && taskOwner ? () => completeTask(task.id) : undefined
                  }
                  onReopen={
                    completed && taskOwner ? () => reopenTask(task.id) : undefined
                  }
                  onDelete={
                    taskOwner
                      ? () =>
                          completed ? deleteHistoryItem(task.id) : deleteTask(task.id)
                      : undefined
                  }
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
