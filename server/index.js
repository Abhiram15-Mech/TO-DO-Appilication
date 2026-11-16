import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "node:path";
import fs from "node:fs";
import { randomUUID, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  db,
  serializeInvitation,
  serializeTask,
  serializeTeam,
} from "./db.js";
import { requireAuth, signToken } from "./auth.js";
import { sendInviteEmail } from "./mailer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const wrap = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCredentials(email, password) {
  if (!validateEmail(email)) return "Enter a valid email address.";
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  return null;
}

function publicUser(row) {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[bytes[index] % alphabet.length];
  }
  return code;
}

function getMembership(teamId, userId) {
  return db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(teamId, userId);
}

function getTeamRow(teamId) {
  return db.prepare("SELECT * FROM teams WHERE id = ?").get(teamId);
}

function getTaskWithOwner(taskId) {
  return db
    .prepare(
      `SELECT t.*, u.email AS owner_email
       FROM tasks t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`
    )
    .get(taskId);
}

function teamForUser(teamId, userId) {
  const row = db
    .prepare(
      `SELECT t.*, tm.role,
        (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS member_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE t.id = ? AND tm.user_id = ?`
    )
    .get(teamId, userId);
  return row ? serializeTeam(row) : null;
}

function applyTaskUpdate(req, res, task) {
  const updates = [];
  const values = [];

  if (typeof req.body.text === "string") {
    const text = req.body.text.trim();
    if (!text) return res.status(400).json({ error: "Task text cannot be empty." });
    if (text.length > 200) {
      return res.status(400).json({ error: "Task text must be 200 characters or fewer." });
    }
    updates.push("text = ?");
    values.push(text);
  }

  if (req.body.deadline !== undefined) {
    updates.push("deadline = ?");
    values.push(req.body.deadline ? String(req.body.deadline) : null);
  }

  if (req.body.progress !== undefined) {
    const progress = Number(req.body.progress);
    if (!Number.isFinite(progress)) {
      return res.status(400).json({ error: "Progress must be a number." });
    }
    updates.push("progress = ?");
    values.push(Math.min(100, Math.max(0, Math.round(progress))));
  }

  if (req.body.steps !== undefined) {
    if (!Array.isArray(req.body.steps)) {
      return res.status(400).json({ error: "Steps must be an array." });
    }
    updates.push("steps = ?");
    values.push(JSON.stringify(req.body.steps));
  }

  if (req.body.comments !== undefined) {
    if (!Array.isArray(req.body.comments)) {
      return res.status(400).json({ error: "Comments must be an array." });
    }
    updates.push("comments = ?");
    values.push(JSON.stringify(req.body.comments));
  }

  if (req.body.completedAt !== undefined) {
    updates.push("completed_at = ?");
    values.push(req.body.completedAt ? String(req.body.completedAt) : null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "No valid fields to update." });
  }

  values.push(task.id);
  db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  res.json({ task: serializeTask(getTaskWithOwner(task.id)) });
}

/* ---------------------------------- auth --------------------------------- */

app.post(
  "/api/auth/register",
  wrap(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;
    const error = validateCredentials(email, password);
    if (error) return res.status(400).json({ error });

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();
    const info = db
      .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
      .run(email, passwordHash, createdAt);

    const user = { id: Number(info.lastInsertRowid), email, created_at: createdAt };
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  })
);

app.post(
  "/api/auth/login",
  wrap(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    const valid = row ? await bcrypt.compare(String(password || ""), row.password_hash) : false;
    if (!valid) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    res.json({ token: signToken(row), user: publicUser(row) });
  })
);

app.get("/api/auth/me", requireAuth, (req, res) => {
  const row = db
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .get(req.userId);
  if (!row) return res.status(401).json({ error: "Account not found." });
  res.json({ user: publicUser(row) });
});

/* ------------------------------ personal tasks --------------------------- */

app.get("/api/tasks", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      "SELECT * FROM tasks WHERE user_id = ? AND team_id IS NULL ORDER BY created_at DESC"
    )
    .all(req.userId);

  const tasks = rows.filter((row) => !row.completed_at).map(serializeTask);
  const history = rows
    .filter((row) => row.completed_at)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    .map(serializeTask);

  res.json({ tasks, history });
});

app.post("/api/tasks", requireAuth, (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Task text is required." });
  if (text.length > 200) {
    return res.status(400).json({ error: "Task text must be 200 characters or fewer." });
  }

  const deadline = req.body.deadline ? String(req.body.deadline) : null;
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO tasks (id, user_id, text, created_at, deadline, progress, steps, comments, team_id)
     VALUES (?, ?, ?, ?, ?, 0, '[]', '[]', NULL)`
  ).run(id, req.userId, text, createdAt, deadline);

  res.status(201).json({ task: serializeTask(getTaskWithOwner(id)) });
});

app.patch("/api/tasks/:id", requireAuth, (req, res) => {
  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ? AND team_id IS NULL")
    .get(req.params.id, req.userId);
  if (!task) return res.status(404).json({ error: "Task not found." });
  applyTaskUpdate(req, res, task);
});

app.delete("/api/tasks/:id", requireAuth, (req, res) => {
  db.prepare(
    "DELETE FROM tasks WHERE id = ? AND user_id = ? AND team_id IS NULL"
  ).run(req.params.id, req.userId);
  res.json({ ok: true });
});

app.delete("/api/history", requireAuth, (req, res) => {
  db.prepare(
    "DELETE FROM tasks WHERE user_id = ? AND team_id IS NULL AND completed_at IS NOT NULL"
  ).run(req.userId);
  res.json({ ok: true });
});

/* ---------------------------------- teams -------------------------------- */

app.get("/api/teams", requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, tm.role,
        (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id) AS member_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = ?
       ORDER BY t.created_at ASC`
    )
    .all(req.userId);

  res.json({ teams: rows.map(serializeTeam) });
});

app.post("/api/teams", requireAuth, (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Team name is required." });
  if (name.length > 80) {
    return res.status(400).json({ error: "Team name must be 80 characters or fewer." });
  }

  let inviteCode = makeInviteCode();
  while (db.prepare("SELECT 1 FROM teams WHERE invite_code = ?").get(inviteCode)) {
    inviteCode = makeInviteCode();
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO teams (id, name, invite_code, owner_id, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, inviteCode, req.userId, createdAt);
  db.prepare(
    "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)"
  ).run(id, req.userId, createdAt);

  res.status(201).json({ team: teamForUser(id, req.userId) });
});

app.post("/api/teams/join", requireAuth, (req, res) => {
  const code = String(req.body.code || "").trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Invite code is required." });

  const team = db.prepare("SELECT * FROM teams WHERE invite_code = ?").get(code);
  if (!team) return res.status(404).json({ error: "Invalid invite code." });

  const existing = getMembership(team.id, req.userId);
  if (!existing) {
    db.prepare(
      "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
    ).run(team.id, req.userId, new Date().toISOString());
  }

  res.json({ team: teamForUser(team.id, req.userId) });
});

app.get("/api/teams/:id", requireAuth, (req, res) => {
  if (!getMembership(req.params.id, req.userId)) {
    return res.status(403).json({ error: "You are not a member of this team." });
  }

  const team = teamForUser(req.params.id, req.userId);
  if (!team) return res.status(404).json({ error: "Team not found." });

  const members = db
    .prepare(
      `SELECT u.id, u.email, tm.role, tm.joined_at
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ?
       ORDER BY tm.joined_at ASC`
    )
    .all(req.params.id)
    .map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      joinedAt: row.joined_at,
    }));

  res.json({ team, members });
});

/* ------------------------------- team tasks ------------------------------ */

app.get("/api/teams/:id/tasks", requireAuth, (req, res) => {
  if (!getMembership(req.params.id, req.userId)) {
    return res.status(403).json({ error: "You are not a member of this team." });
  }

  const rows = db
    .prepare(
      `SELECT t.*, u.email AS owner_email
       FROM tasks t JOIN users u ON u.id = t.user_id
       WHERE t.team_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(req.params.id);

  const tasks = rows.filter((row) => !row.completed_at).map(serializeTask);
  const history = rows
    .filter((row) => row.completed_at)
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)))
    .map(serializeTask);

  res.json({ tasks, history });
});

app.post("/api/teams/:id/tasks", requireAuth, (req, res) => {
  if (!getMembership(req.params.id, req.userId)) {
    return res.status(403).json({ error: "You are not a member of this team." });
  }

  const text = String(req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Task text is required." });
  if (text.length > 200) {
    return res.status(400).json({ error: "Task text must be 200 characters or fewer." });
  }

  const deadline = req.body.deadline ? String(req.body.deadline) : null;
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(
    `INSERT INTO tasks (id, user_id, text, created_at, deadline, progress, steps, comments, team_id)
     VALUES (?, ?, ?, ?, ?, 0, '[]', '[]', ?)`
  ).run(id, req.userId, text, createdAt, deadline, req.params.id);

  res.status(201).json({ task: serializeTask(getTaskWithOwner(id)) });
});

app.patch("/api/teams/:id/tasks/:taskId", requireAuth, (req, res) => {
  if (!getMembership(req.params.id, req.userId)) {
    return res.status(403).json({ error: "You are not a member of this team." });
  }

  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ? AND team_id = ?")
    .get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found." });
  if (task.user_id !== req.userId) {
    return res.status(403).json({ error: "Only the task owner can edit this task." });
  }

  applyTaskUpdate(req, res, task);
});

app.post("/api/teams/:id/tasks/:taskId/comments", requireAuth, (req, res) => {
  if (!getMembership(req.params.id, req.userId)) {
    return res.status(403).json({ error: "You are not a member of this team." });
  }

  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ? AND team_id = ?")
    .get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found." });

  const text = String(req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "Comment text is required." });
  if (text.length > 500) {
    return res.status(400).json({ error: "Comment must be 500 characters or fewer." });
  }

  let comments = [];
  try {
    comments = JSON.parse(task.comments);
    if (!Array.isArray(comments)) comments = [];
  } catch {
    comments = [];
  }

  comments.push({
    id: randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    authorId: req.userId,
    authorEmail: req.userEmail,
  });

  db.prepare("UPDATE tasks SET comments = ? WHERE id = ?").run(
    JSON.stringify(comments),
    task.id
  );

  res.status(201).json({ task: serializeTask(getTaskWithOwner(task.id)) });
});

app.delete("/api/teams/:id/tasks/:taskId", requireAuth, (req, res) => {
  if (!getMembership(req.params.id, req.userId)) {
    return res.status(403).json({ error: "You are not a member of this team." });
  }

  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ? AND team_id = ?")
    .get(req.params.taskId, req.params.id);
  if (!task) return res.status(404).json({ error: "Task not found." });
  if (task.user_id !== req.userId) {
    return res.status(403).json({ error: "Only the task owner can delete this task." });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(task.id);
  res.json({ ok: true });
});

app.delete("/api/teams/:id/history", requireAuth, (req, res) => {
  const team = getTeamRow(req.params.id);
  if (!team || !getMembership(req.params.id, req.userId)) {
    return res.status(403).json({ error: "You are not a member of this team." });
  }
  if (team.owner_id !== req.userId) {
    return res.status(403).json({ error: "Only the team owner can clear team history." });
  }

  db.prepare(
    "DELETE FROM tasks WHERE team_id = ? AND completed_at IS NOT NULL"
  ).run(req.params.id);
  res.json({ ok: true });
});

/* ------------------------------- invitations ----------------------------- */

app.post(
  "/api/teams/:id/invitations",
  requireAuth,
  wrap(async (req, res) => {
    const team = getTeamRow(req.params.id);
    if (!team) return res.status(404).json({ error: "Team not found." });
    if (team.owner_id !== req.userId) {
      return res.status(403).json({ error: "Only the team owner can invite people." });
    }

    const email = normalizeEmail(req.body.email);
    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const alreadyMember = db
      .prepare(
        `SELECT 1 FROM team_members tm JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = ? AND u.email = ?`
      )
      .get(req.params.id, email);
    if (alreadyMember) {
      return res.status(409).json({ error: "That person is already in the team." });
    }

    const inviter = db.prepare("SELECT email FROM users WHERE id = ?").get(req.userId);
    const now = new Date().toISOString();
    const existing = db
      .prepare("SELECT * FROM team_invitations WHERE team_id = ? AND email = ?")
      .get(req.params.id, email);

    let invitationId;
    if (existing) {
      invitationId = existing.id;
      db.prepare(
        "UPDATE team_invitations SET status = 'pending', invited_by = ?, created_at = ? WHERE id = ?"
      ).run(req.userId, now, invitationId);
    } else {
      invitationId = randomUUID();
      db.prepare(
        `INSERT INTO team_invitations (id, team_id, email, invited_by, status, created_at)
         VALUES (?, ?, ?, ?, 'pending', ?)`
      ).run(invitationId, req.params.id, email, req.userId, now);
    }

    let emailSent = false;
    try {
      emailSent = await sendInviteEmail({
        to: email,
        teamName: team.name,
        inviterEmail: inviter.email,
        inviteCode: team.invite_code,
      });
    } catch (mailError) {
      console.error("[invite] Failed to send email:", mailError.message);
    }

    const row = db
      .prepare(
        `SELECT i.*, t.name AS team_name, u.email AS inviter_email
         FROM team_invitations i
         JOIN teams t ON t.id = i.team_id
         JOIN users u ON u.id = i.invited_by
         WHERE i.id = ?`
      )
      .get(invitationId);

    res.status(201).json({
      invitation: serializeInvitation(row),
      emailSent,
    });
  })
);

app.get("/api/invitations", requireAuth, (req, res) => {
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(req.userId);
  if (!user) return res.status(401).json({ error: "Account not found." });

  const rows = db
    .prepare(
      `SELECT i.*, t.name AS team_name, u.email AS inviter_email
       FROM team_invitations i
       JOIN teams t ON t.id = i.team_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.email = ? AND i.status = 'pending'
       ORDER BY i.created_at DESC`
    )
    .all(user.email);

  res.json({ invitations: rows.map(serializeInvitation) });
});

app.post("/api/invitations/:id/accept", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(req.userId);
  const invitation = db
    .prepare("SELECT * FROM team_invitations WHERE id = ?")
    .get(req.params.id);

  if (!invitation || invitation.email !== user.email) {
    return res.status(404).json({ error: "Invitation not found." });
  }
  if (invitation.status !== "pending") {
    return res.status(409).json({ error: "This invitation is no longer pending." });
  }

  const existing = getMembership(invitation.team_id, req.userId);
  if (!existing) {
    db.prepare(
      "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)"
    ).run(invitation.team_id, req.userId, new Date().toISOString());
  }
  db.prepare("UPDATE team_invitations SET status = 'accepted' WHERE id = ?").run(
    invitation.id
  );

  res.json({ team: teamForUser(invitation.team_id, req.userId) });
});

app.post("/api/invitations/:id/decline", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(req.userId);
  const invitation = db
    .prepare("SELECT * FROM team_invitations WHERE id = ?")
    .get(req.params.id);

  if (!invitation || invitation.email !== user.email) {
    return res.status(404).json({ error: "Invitation not found." });
  }

  db.prepare("UPDATE team_invitations SET status = 'declined' WHERE id = ?").run(
    invitation.id
  );
  res.json({ ok: true });
});

/* --------------------------------- static -------------------------------- */

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Not found." });
});

const distPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
