import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import { config } from "./config.js";
import PersonalBoard from "./PersonalBoard.jsx";
import TeamBoard from "./TeamBoard.jsx";
import TeamManager from "./TeamManager.jsx";

export default function TodoApp({ user, onLogout }) {
  const [view, setView] = useState("personal");
  const [teams, setTeams] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState("");

  const loadTeams = useCallback(async () => {
    try {
      const [teamData, inviteData] = await Promise.all([
        api.getTeams(),
        api.getInvitations(),
      ]);
      setTeams(teamData.teams);
      setInvitations(inviteData.invitations);
      setTeamsError("");
    } catch (err) {
      if (err.status === 401) {
        onLogout();
        return;
      }
      setTeamsError(err.message);
    } finally {
      setTeamsLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  async function handleCreateTeam(name) {
    const { team } = await api.createTeam(name);
    setTeams((prev) => [...prev, team]);
    setView(team.id);
  }

  async function handleJoinTeam(code) {
    const { team } = await api.joinTeam(code);
    setTeams((prev) =>
      prev.some((item) => item.id === team.id) ? prev : [...prev, team]
    );
    setView(team.id);
  }

  async function handleAcceptInvitation(id) {
    const { team } = await api.acceptInvitation(id);
    setInvitations((prev) => prev.filter((item) => item.id !== id));
    setTeams((prev) =>
      prev.some((item) => item.id === team.id) ? prev : [...prev, team]
    );
    setView(team.id);
  }

  async function handleDeclineInvitation(id) {
    await api.declineInvitation(id);
    setInvitations((prev) => prev.filter((item) => item.id !== id));
  }

  const isTeamView = view !== "personal" && view !== "teams";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Workspace</p>
          <h2>{config.appName}</h2>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${view === "personal" ? "is-active" : ""}`}
            onClick={() => setView("personal")}
          >
            <span className="nav-bullet" />
            My Tasks
          </button>

          <div className="sidebar-section">
            <span className="sidebar-label">Teams</span>
            {teamsLoading ? (
              <span className="sidebar-muted">Loading...</span>
            ) : teams.length === 0 ? (
              <span className="sidebar-muted">No teams yet</span>
            ) : (
              teams.map((team) => (
                <button
                  key={team.id}
                  className={`nav-item ${view === team.id ? "is-active" : ""}`}
                  onClick={() => setView(team.id)}
                >
                  <span className="team-dot" />
                  <span className="nav-name">{team.name}</span>
                  <span className="nav-count">{team.memberCount}</span>
                </button>
              ))
            )}
          </div>

          <button
            className={`nav-item ${view === "teams" ? "is-active" : ""}`}
            onClick={() => setView("teams")}
          >
            <span className="nav-bullet nav-bullet-outline" />
            Create / Join Team
            {invitations.length > 0 && (
              <span className="nav-badge">{invitations.length}</span>
            )}
          </button>

          {teamsError && <span className="sidebar-error">{teamsError}</span>}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-user">{user.email}</span>
          <button className="btn btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="main-area">
        {view === "personal" && <PersonalBoard onAuthError={onLogout} />}
        {view === "teams" && (
          <TeamManager
            teams={teams}
            invitations={invitations}
            loading={teamsLoading}
            onOpenTeam={setView}
            onCreate={handleCreateTeam}
            onJoin={handleJoinTeam}
            onAccept={handleAcceptInvitation}
            onDecline={handleDeclineInvitation}
          />
        )}
        {isTeamView && (
          <TeamBoard
            key={view}
            user={user}
            teamId={view}
            onAuthError={onLogout}
          />
        )}
      </main>
    </div>
  );
}
