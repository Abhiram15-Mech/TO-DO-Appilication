export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="btn btn-ghost theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <span className={`theme-icon ${isDark ? "is-dark" : ""}`} aria-hidden="true" />
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
