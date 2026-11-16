import { useState } from "react";

export default function TeamManager({
  teams,
  invitations,
  loading,
  onOpenTeam,
  onCreate,
  onJoin,
  onAccept,
  onDecline,
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(key, task) {
    setBusy(key);
    setError("");
    try {
      await task();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setBusy("");
    }
  }

  function handleCreate(event) {
    event.preventDefault();
    if (!name.trim()) return;
    run("create", async () => {
      await onCreate(name.trim());
      setName("");
    });
  }

  function handleJoin(event) {
    event.preventDefault();
    if (!code.trim()) return;
    run("join", async () => {
      await onJoin(code.trim());
      setCode("");
    });
  }

  return (
    <div className="page-content">
      <header className="app-header">
        <div>
          <p className="eyebrow">Team workspace</p>
          <h1>Teams</h1>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      {invitations.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <p className="panel-title">Pending invitations</p>
          </div>
          <ul className="invite-list">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="invite-card">
                <div>
                  <p className="invite-team">{invitation.teamName}</p>
                  <p className="details-hint">
                    Invited by {invitation.inviterEmail}
                  </p>
                </div>
                <div className="invite-actions">
                  <button
                    className="btn btn-small"
                    disabled={busy === `accept-${invitation.id}`}
                    onClick={() =>
                      run(`accept-${invitation.id}`, () => onAccept(invitation.id))
                    }
                  >
                    Accept
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={busy === `decline-${invitation.id}`}
                    onClick={() =>
                      run(`decline-${invitation.id}`, () => onDecline(invitation.id))
                    }
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="team-setup-grid">
        <section className="panel setup-card">
          <div className="panel-head">
            <p className="panel-title">Create a team</p>
          </div>
          <form className="inline-form" onSubmit={handleCreate}>
            <input
              className="inline-input"
              type="text"
              placeholder="Team or project name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              aria-label="Team name"
            />
            <button
              className="btn btn-small"
              type="submit"
              disabled={!name.trim() || busy === "create"}
            >
              Create
            </button>
          </form>
          <p className="details-hint">
            You become the host and can invite teammates by email.
          </p>
        </section>

        <section className="panel setup-card">
          <div className="panel-head">
            <p className="panel-title">Join a team</p>
          </div>
          <form className="inline-form" onSubmit={handleJoin}>
            <input
              className="inline-input"
              type="text"
              placeholder="8-character invite code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={12}
              aria-label="Invite code"
            />
            <button
              className="btn btn-small"
              type="submit"
              disabled={!code.trim() || busy === "join"}
            >
              Join
            </button>
          </form>
          <p className="details-hint">Ask the host for the team invite code.</p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <p className="panel-title">Your teams</p>
        </div>
        {loading ? (
          <div className="empty">
            <p className="empty-text">Loading teams...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No teams yet</p>
            <p className="empty-text">Create a team or join one with an invite code.</p>
          </div>
        ) : (
          <ul className="team-list">
            {teams.map((team) => (
              <li key={team.id}>
                <button className="team-list-item" onClick={() => onOpenTeam(team.id)}>
                  <span className="team-list-main">
                    <strong>{team.name}</strong>
                    <span className="details-hint">
                      {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                    </span>
                  </span>
                  <span className="pill">{team.role}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
