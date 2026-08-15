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
   * Applies a theme: sets data-theme, persists it, and updates every toggle.
   * @param t "dark" or "light"
   * @note Doesn't persist in preview mode - the preview iframe shares
   * localStorage and must not change the real site's saved theme.
   */
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    if (!/[?&]preview=1(&|$)/.test(window.location.search)) {
      try { localStorage.setItem("theme", t); } catch (e) {} /* private mode */
    }
    updateIcon(t);
    /* re-resolve every ta-set colour against the new theme, else they stay
       frozen at whichever theme was active on load. window.-gated: a page
       with no tracked elements never loaded main.js's override passes. */
    if (window.reapplyThemedColors) window.reapplyThemedColors();
    /* the open style popover's swatches have to swap which of light/dark is
       primary too, or they keep showing the theme they were opened under */
    if (window.refreshStyleMenuTheme) window.refreshStyleMenuTheme();
  }

  /**
   * Syncs every toggle's label to the theme (the sun/moon svg swap is pure
   * css, driven by [data-theme]).
   * @param t "dark" or "light"
   * @note A label a ta has typed an override into (data-overridden) keeps
   * its own text instead of being stomped back to "Light mode"/"Dark mode".
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
    /* delegated, so a "theme" element placed after this listener is set up
       (content fetches async) still gets a working click with no re-wiring */
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest("[data-theme-toggle], #themeBtn");
      if (!btn) return;
      /* inert in the visual editor: every click there is a ta selecting,
         dragging or editing the button, and flipping the theme mid-drag
         resized and recoloured it, which read as a broken element. The
         right-click menu's light/dark entry is the editor's own way in. */
      if (document.body.classList.contains("edit-mode")) return;
      setTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  });

  /* re-syncs every toggle's label; called by main.js after it applies saved
     text overrides and whenever a ta places a new toggle */
  window.refreshThemeToggles = function () { updateIcon(currentTheme()); };

  /* the visual editor's own light/dark entry goes through this, so labels
     and ta-picked themed colours re-resolve exactly as on the live site */
  window.setSiteTheme = setTheme;
})();
