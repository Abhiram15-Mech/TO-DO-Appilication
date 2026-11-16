# Tasks & History

A full-stack todo app for personal tasks and team workspaces. Track deadlines, break tasks into parts, watch progress, and leave progress notes. Includes email/password authentication, team invites, and a light/dark theme.

## Features

- **Personal tasks** — private to your account
- **Deadlines** — date-only deadlines with overdue highlighting
- **Parts and progress** — break a task into parts and see a live progress bar
- **Progress notes** — comment on tasks as work advances
- **Filters** — All, Pending, Overdue, Completed
- **Reopen tasks** — move a completed task back to pending if it was marked by mistake
- **History** — completed tasks and one-click cleanup
- **Teams** — create a team, invite teammates by email or invite code
- **Shared team tasks** — every member sees all team tasks and their owners
- **Permissions** — only the task owner can complete, edit, or delete it; teammates can comment
- **Light/dark theme** — toggle persisted in `localStorage`

## Tech Stack

| Layer    | Technology                                |
| -------- | ----------------------------------------- |
| Frontend | React 18, Vite 5                          |
| Backend  | Node.js, Express 4                        |
| Database | SQLite via better-sqlite3                 |
| Auth     | JWT + bcryptjs                            |
| Email    | Nodemailer (optional SMTP)                |

## Getting Started

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000 (Vite proxies `/api`)

The SQLite database is created automatically at `server/data.sqlite`.

### Production

```bash
npm run build
npm start
```

Open http://localhost:4000. Express serves the built React app from `dist/`.

## Scripts

| Script            | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Run frontend and API together            |
| `npm run dev:web` | Run only the Vite frontend               |
| `npm run dev:server` | Run only the API with file watching   |
| `npm run build`   | Build the React app into `dist/`         |
| `npm start`       | Run the API and serve `dist/`            |
| `npm run preview` | Preview the production build with Vite   |

## Environment Variables

All are optional for local development.

| Variable    | Default                          | Purpose                                   |
| ----------- | -------------------------------- | ----------------------------------------- |
| `PORT`      | `4000`                           | API server port                           |
| `DB_PATH`   | `server/data.sqlite`             | SQLite database file path                 |
| `JWT_SECRET`| dev-only value                   | **Set this in production**                |
| `SMTP_HOST` | unset                            | Enables email sending for invites         |
| `SMTP_PORT` | `587`                            | SMTP port (`465` enables TLS)             |
| `SMTP_USER` | unset                            | SMTP username                             |
| `SMTP_PASS` | unset                            | SMTP password                             |
| `SMTP_FROM` | `SMTP_USER`                      | Sender address                            |
| `APP_URL`   | unset                            | App link included in invite emails        |

Invitations are always stored in-app, so teammates can accept them after signing in. If SMTP is not configured, no email is sent; the app logs the invite instead.

## Team Permissions

- The team owner can invite members and clear team history.
- Any team member can create team tasks.
- Only a task's owner can complete, edit, or delete it.
- Other members can view task details and add progress notes.

## Project Structure

```text
├── server/
│   ├── index.js      # Express app and REST routes
│   ├── db.js         # SQLite schema and serializers
│   ├── auth.js       # JWT signing and auth middleware
│   └── mailer.js     # Optional SMTP invite emails
├── src/
│   ├── App.jsx       # Auth gate and global theme
│   ├── AuthScreen.jsx
│   ├── TodoApp.jsx   # Sidebar layout
│   ├── PersonalBoard.jsx
│   ├── TeamBoard.jsx
│   ├── TeamManager.jsx
│   ├── TaskCard.jsx
│   ├── TaskDetails.jsx
│   ├── ThemeToggle.jsx
│   ├── api.js        # Fetch wrapper for the API
│   ├── theme.js
│   ├── utils.js
│   ├── config.js
│   └── index.css
└── vite.config.js
```

## Data Storage

Data lives in SQLite (`users`, `tasks`, `teams`, `team_members`, `team_invitations`). The database file and `node_modules`/`dist` are ignored by Git. Back up `server/data.sqlite` to preserve your data.
