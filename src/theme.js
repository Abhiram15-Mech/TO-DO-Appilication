const THEME_KEY = "task-history-app.theme";

export function getInitialTheme(fallback = "light") {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return fallback;
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

export function nextTheme(theme) {
  return theme === "dark" ? "light" : "dark";
}
