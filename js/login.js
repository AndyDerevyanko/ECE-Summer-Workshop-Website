/* login posts to /api/login, which checks the hashed credentials in the
   database.

   The form itself isn't markup in templates/login.html any more - the two
   credential boxes, the submit button and the failure line are placed visual-
   editor elements a ta can move, restyle, delete and re-add (see app/db.py's
   _LOGIN_ENTRIES and buildCustomElementNode()'s "loginField"/"loginButton"/
   "loginError" kinds in js/main.js). So nothing here holds a reference to a
   specific node: every listener is delegated off `document` and every lookup
   goes through the data-login-* markers those kinds stamp on, which means a
   box a ta adds ten minutes into an editing session is live the instant it's
   placed, with no re-wiring and no bookkeeping. */

(function () {
  /**
   * True while this page is being rendered inside the ta portal's preview /
   * visual-editor iframe. Posting real credentials from there would swap the
   * ta's own session out mid-edit and navigate the iframe away from the page
   * they're editing, so the submit button stays inert instead.
   * Falls back to reading the query string itself if js/main.js somehow
   * didn't load, rather than defaulting to "live" and posting anyway.
   * @return true in the portal's iframe
   */
  function inEditor() {
    if (window.isPreviewMode) return window.isPreviewMode();
    return /[?&]preview=1(&|$)/.test(window.location.search);
  }

  /**
   * The first placed input of one kind. "First" rather than "the one with
   * this id" because a ta can delete the seeded box and add their own, and
   * can in principle end up with two - in which case the topmost one in the
   * document is the one that counts, same rule the rest of the editor's
   * shared-id elements follow.
   * @param which "username" or "password"
   * @return the input element, or null
   */
  function inputFor(which) {
    return document.querySelector('[data-login-input="' + which + '"]');
  }

  /**
   * Shows one of the failure line's two strings (see
   * buildCustomElementNode()'s "loginError" kind - it carries both, each
   * independently editable, and this picks which is live), or hides the
   * whole line again.
   * @param which "bad", "expired", or "" to hide it
   */
  function showError(which) {
    document.querySelectorAll('[data-login-el="error"]').forEach(function (el) {
      el.classList.toggle("show", !!which);
      el.classList.toggle("show-bad", which === "bad");
      el.classList.toggle("show-expired", which === "expired");
    });
  }

  /**
   * Hides a box's greyed placeholder text once something's been typed into
   * it. The placeholder is a real editable text field sitting over the input
   * rather than the input's own placeholder attribute (which is the only way
   * a ta could restyle or reword it), so its visibility is ours to manage.
   * @param input a [data-login-input] element
   */
  function syncPlaceholder(input) {
    var box = input.closest(".login-field-box");
    if (box) box.classList.toggle("has-value", !!input.value);
  }

  /** Posts whatever's in the credential boxes, and acts on the answer. */
  function submitLogin() {
    if (inEditor()) return;
    var userEl = inputFor("username");
    var passEl = inputFor("password");
    var user = (userEl && userEl.value.trim()) || "";
    var pass = (passEl && passEl.value) || "";

    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("bad login");
        return res.json();
      })
      .then(function (data) {
        localStorage.setItem("session", data.username);
        localStorage.setItem("role", data.role);
        localStorage.setItem("token", data.token);
        /* fresh start for the idle clock (js/idle.js), a stale timestamp
           from an old visit would log the new session straight back out */
        localStorage.setItem("last_active", String(Date.now()));
        window.location.href = data.role === "ta" ? "instructor.html" : "dashboard.html";
      })
      .catch(function () { showError("bad"); });
  }

  /**
   * Brings the placed elements up to date with the current page state:
   * placeholder visibility per box, and the "you were idled out" line if
   * that's why we're here. Called by js/main.js's applySharedEditorOverrides()
   * once the elements actually exist, and again by finishAddedElement()
   * whenever a ta places a new one - the same window.-hook convention
   * window.renderExtras/window.renderDays use on the dashboard.
   */
  function refreshLoginPage() {
    document.querySelectorAll("[data-login-input]").forEach(syncPlaceholder);
    /* bounced here by an idle-timed-out session (see handleExpiredSession in
       js/ta.js and js/accounts.js), say so instead of a blank form. Only on
       the real page: inside the editor the failure line is always shown (both
       strings at once) so a ta can edit it, see css/style.css. */
    if (!inEditor() && /[?&]expired=1(&|$)/.test(window.location.search)) showError("expired");
  }

  /**
   * Last-resort form for when /api/content is unreachable, so an outage in
   * the content api can't lock everyone out of a working site (see
   * initLoginPage() in js/main.js, the only caller). Plain markup dropped
   * into the seeded elements' own anchors, carrying the same data-login-*
   * markers everything above keys off, so it behaves like the real thing
   * minus whatever styling a ta had saved.
   */
  function buildLoginFallback() {
    if (document.querySelector("[data-login-input]")) return;
    /* one piece per anchor rather than all four dropped into the first one:
       the "Username"/"Password" captions are ordinary markup in
       templates/login.html now (so nothing here builds them), and they sit
       between the anchors - piling every field into the username slot would
       leave the password caption stranded underneath the whole form. */
    var slots = [
      /* real placeholder attributes here, unlike the placed elements' own
         editable placeholder spans (see buildCustomElementNode()): nothing
         builds those spans on this path, and an empty grey box with no hint
         in it is exactly the wrong thing to hand someone who is already
         looking at a half-broken page */
      ["loginUserAnchor",
        '<div class="login-field" data-login-el="field"><div class="login-field-box">' +
        '<input class="login-field-input" type="text" autocomplete="username" aria-label="Username" ' +
        'placeholder="the username you were given" data-login-input="username"></div></div>'],
      ["loginPassAnchor",
        '<div class="login-field" data-login-el="field"><div class="login-field-box">' +
        '<input class="login-field-input" type="password" autocomplete="current-password" aria-label="Password" ' +
        'placeholder="and its password" data-login-input="password"></div></div>'],
      ["loginSubmitAnchor",
        '<button class="btn btn-primary login-submit" type="button" data-login-el="submit">Log in</button>'],
      ["loginErrorAnchor",
        '<div class="login-error" data-login-el="error">' +
        '<span class="login-error-msg" data-login-msg="bad">Wrong username or password. Check with a staff member.</span>' +
        '<span class="login-error-msg" data-login-msg="expired">You were logged out after a while of inactivity. Log in again.</span></div>']
    ];
    slots.forEach(function (slot) {
      var anchor = document.getElementById(slot[0]);
      if (!anchor || !anchor.parentNode) return;
      var wrap = document.createElement("div");
      wrap.innerHTML = slot[1];
      while (wrap.firstChild) anchor.parentNode.insertBefore(wrap.firstChild, anchor);
      /* the spacer has done its job: it exists to hold a slot open for an
         absolutely-positioned placed element, and what just went in is a
         normal in-flow one that takes its own room. Leaving it would double
         the gap under every field. */
      anchor.style.display = "none";
    });
    refreshLoginPage();
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest('[data-login-el="submit"]');
    if (!btn) return;
    /* in the editor the click belongs to the editor (select the button,
       type in its label) and inEditor() stops the post anyway - preventing
       the default here as well just keeps a real <button> from doing
       anything of its own on top of that */
    e.preventDefault();
    submitLogin();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var input = e.target;
    if (!input || !input.hasAttribute || !input.hasAttribute("data-login-input")) return;
    e.preventDefault();
    submitLogin();
  });

  document.addEventListener("input", function (e) {
    var input = e.target;
    if (input && input.hasAttribute && input.hasAttribute("data-login-input")) syncPlaceholder(input);
  });

  window.refreshLoginPage = refreshLoginPage;
  window.buildLoginFallback = buildLoginFallback;
  document.addEventListener("DOMContentLoaded", refreshLoginPage);
})();
