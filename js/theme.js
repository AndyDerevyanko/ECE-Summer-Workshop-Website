/* light/dark toggle */

(function () {
  /**
   * Returns the theme currently applied to the page.
   * @return "dark" or "light"
   */
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  /**
   * Applies a theme: sets data-theme, persists it, and updates the toggle icon.
   * Doesn't persist in preview mode (js/preview.js's iframe): the toggle
   * still flips the preview's own look, but shouldn't change the real
   * site's saved theme just because it's shared localStorage.
   * @param t "dark" or "light"
   */
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    if (!/[?&]preview=1(&|$)/.test(window.location.search)) {
      try { localStorage.setItem("theme", t); } catch (e) {} /* private mode */
    }
    updateIcon(t);
  }

  /**
   * Updates the toggle button's label to match the theme (the sun/moon svg
   * swap itself is pure css, driven by [data-theme]).
   * @param t "dark" or "light"
   */
  function updateIcon(t) {
    var btn = document.getElementById("themeBtn");
    if (!btn) return;
    /* css swaps the sun/moon svg via [data-theme], label text follows the same swap */
    btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
    var label = btn.querySelector(".tic-label");
    if (label) label.textContent = t === "dark" ? "Light mode" : "Dark mode";
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateIcon(currentTheme());
    var btn = document.getElementById("themeBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        setTheme(currentTheme() === "dark" ? "light" : "dark");
      });
    }
  });
})();
