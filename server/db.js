import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, "data.sqlite");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deadline TEXT,
    progress INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    steps TEXT NOT NULL DEFAULT '[]',
    comments TEXT NOT NULL DEFAULT '[]',
    team_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    owner_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS team_members (
    team_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL,
    PRIMARY KEY (team_id, user_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS team_invitations (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    email TEXT NOT NULL,
    invited_by INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    UNIQUE (team_id, email),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_members_user ON team_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_invitations_email ON team_invitations(email);
`);

const taskColumns = db.prepare("PRAGMA table_info(tasks)").all();
if (!taskColumns.some((column) => column.name === "team_id")) {
  db.exec("ALTER TABLE tasks ADD COLUMN team_id TEXT");
}

db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id);");

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function serializeTask(row) {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    deadline: row.deadline,
    progress: row.progress,
    steps: safeParse(row.steps, []),
    comments: safeParse(row.comments, []),
    completedAt: row.completed_at,
    ownerId: row.user_id,
    ownerEmail: row.owner_email || null,
    teamId: row.team_id || null,
  };
}

export function serializeTeam(row) {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    role: row.role || "member",
    memberCount: Number(row.member_count || 0),
  };
}

export function serializeInvitation(row) {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    email: row.email,
    inviterEmail: row.inviter_email,
    status: row.status,
    createdAt: row.created_at,
  };
}
