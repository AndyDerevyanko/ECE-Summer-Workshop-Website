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
   * Applies a theme: sets data-theme, persists it, and updates every toggle's
   * icon/label.
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
   * Updates every toggle button's label to match the theme (the sun/moon svg
   * swap itself is pure css, driven by [data-theme]): the nav's own
   * #themeBtn, plus any "theme" custom element a ta has placed elsewhere
   * (see buildCustomElement() in js/main.js, tagged data-theme-toggle). A
   * label a ta has typed a custom override into (see applyTextOverrides()'s
   * data-overridden flag) keeps whatever it says instead of being stomped
   * back to the auto "Light mode"/"Dark mode" text every time the theme
   * flips; it's still a real, functioning toggle either way.
   * @param t "dark" or "light"
   */
  function updateIcon(t) {
    document.querySelectorAll("[data-theme-toggle], #themeBtn").forEach(function (btn) {
      btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
      var label = btn.querySelector(".tic-label");
      if (label && label.dataset.overridden !== "1") {
        label.textContent = t === "dark" ? "Light mode" : "Dark mode";
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateIcon(currentTheme());
    /* delegated (not bound per-button): a "theme" custom element placed
       after this listener's set up (fetchContent() resolves async, see
       renderCustomElements() in js/main.js) still gets a working click with
       zero extra wiring, same reasoning the "Add element" menu's own
       document-level listeners already use elsewhere in this codebase. */
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-theme-toggle], #themeBtn");
      if (!btn) return;
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  });

  /* exposed so js/main.js can re-sync every toggle's label right after it
     applies saved text overrides (applyTextOverrides()), both on a normal
     page load and after a ta places a fresh "theme" element in the visual
     editor; a no-op if this script isn't loaded on the current page (see the
     `window.refreshThemeToggles &&` guards at each call site). */
  window.refreshThemeToggles = function () { updateIcon(currentTheme()); };
})();
