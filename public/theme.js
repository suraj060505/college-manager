// theme.js — dark/light mode toggle, shared across all pages
(function () {
  const saved = localStorage.getItem('cm_theme') || 'dark';
  if (saved === 'light') document.body.classList.add('light-theme');

  window.toggleTheme = function () {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('cm_theme', isLight ? 'light' : 'dark');
    updateToggleIcon();
  };

  function updateToggleIcon() {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;
    const isLight = document.body.classList.contains('light-theme');
    btn.textContent = isLight ? '🌙 Dark' : '☀️ Light';
  }

  document.addEventListener('DOMContentLoaded', updateToggleIcon);
})();
