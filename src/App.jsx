import { useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api.js";
import AuthScreen from "./AuthScreen.jsx";
import TodoApp from "./TodoApp.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }

    api
      .me()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  function handleAuth({ token, user: authenticatedUser }) {
    setToken(token);
    setUser(authenticatedUser);
  }

  function handleLogout() {
    clearToken();
    setUser(null);
  }

  if (checking) {
    return (
      <div className="app-shell">
        <div className="empty">
          <p className="empty-text">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onAuth={handleAuth} />;
  }

  return <TodoApp user={user} onLogout={handleLogout} />;
}
