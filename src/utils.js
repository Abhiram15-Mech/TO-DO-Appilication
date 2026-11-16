export function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDeadline(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function toDateInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function deadlineFromDateInput(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function isOverdue(value) {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

export function computeProgress(task) {
  if (task.steps && task.steps.length > 0) {
    const done = task.steps.filter((step) => step.done).length;
    return Math.round((done / task.steps.length) * 100);
  }
  return Math.min(100, Math.max(0, task.progress || 0));
}

export function normalizeTask(task) {
  return {
    ...task,
    deadline: task.deadline || null,
    progress: typeof task.progress === "number" ? task.progress : 0,
    steps: Array.isArray(task.steps) ? task.steps : [],
    comments: Array.isArray(task.comments) ? task.comments : [],
  };
}
