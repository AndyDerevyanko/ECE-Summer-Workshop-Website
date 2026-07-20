// light/dark toggle

(function () {
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }

  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch (e) {} // private mode
    updateIcon(t);
  }

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
