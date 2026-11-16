import { useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api.js";
import { config } from "./config.js";
import AuthScreen from "./AuthScreen.jsx";
import TodoApp from "./TodoApp.jsx";
import { applyTheme, getInitialTheme, nextTheme } from "./theme.js";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [theme, setTheme] = useState(() => getInitialTheme(config.theme));

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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

  function toggleTheme() {
    setTheme((current) => nextTheme(current));
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
    return (
      <AuthScreen
        onAuth={handleAuth}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <TodoApp
      user={user}
      onLogout={handleLogout}
      theme={theme}
      onToggleTheme={toggleTheme}
    />
  );
}
