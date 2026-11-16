const TOKEN_KEY = "task-history-app.token";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`/api${path}`, { ...options, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || `Request failed (${response.status})`,
      response.status
    );
  }

  return data;
}

export const api = {
  register(email, password) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  login(email, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },
  me() {
    return request("/auth/me");
  },
  getTasks() {
    return request("/tasks");
  },
  createTask(text, deadline) {
    return request("/tasks", {
      method: "POST",
      body: JSON.stringify({ text, deadline }),
    });
  },
  updateTask(id, patch) {
    return request(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  deleteTask(id) {
    return request(`/tasks/${id}`, { method: "DELETE" });
  },
  clearHistory() {
    return request("/history", { method: "DELETE" });
  },
  getTeams() {
    return request("/teams");
  },
  createTeam(name) {
    return request("/teams", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  },
  joinTeam(code) {
    return request("/teams/join", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  },
  getTeam(id) {
    return request(`/teams/${id}`);
  },
  getTeamTasks(id) {
    return request(`/teams/${id}/tasks`);
  },
  createTeamTask(id, text, deadline) {
    return request(`/teams/${id}/tasks`, {
      method: "POST",
      body: JSON.stringify({ text, deadline }),
    });
  },
  updateTeamTask(teamId, taskId, patch) {
    return request(`/teams/${teamId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },
  addTeamComment(teamId, taskId, text) {
    return request(`/teams/${teamId}/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
  deleteTeamTask(teamId, taskId) {
    return request(`/teams/${teamId}/tasks/${taskId}`, { method: "DELETE" });
  },
  clearTeamHistory(teamId) {
    return request(`/teams/${teamId}/history`, { method: "DELETE" });
  },
  inviteToTeam(teamId, email) {
    return request(`/teams/${teamId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  getInvitations() {
    return request("/invitations");
  },
  acceptInvitation(id) {
    return request(`/invitations/${id}/accept`, { method: "POST" });
  },
  declineInvitation(id) {
    return request(`/invitations/${id}/decline`, { method: "POST" });
  },
};
