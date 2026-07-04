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
    //theme icon
    btn.textContent = t === "dark" ? "☼" : "☾";
    btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
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
