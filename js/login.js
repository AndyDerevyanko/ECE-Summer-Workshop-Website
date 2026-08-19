/* login posts to /api/login, which checks the hashed credentials in the db.

   The form isn't markup in templates/login.html any more: the boxes, button
   and failure line are placed visual-editor elements a ta can move, restyle,
   delete and re-add. So nothing here holds a node reference - every listener
   is delegated off `document` and every lookup goes through the data-login-*
   markers, which makes a box added mid-session live the instant it's placed. */

(function () {
  /**
   * True while this page is rendered inside the portal's preview/editor
   * iframe, where posting real credentials would swap out the ta's own
   * session and navigate away from the page they're editing.
   * @return true in the portal's iframe
   */
  function inEditor() {
    if (window.isPreviewMode) return window.isPreviewMode();
    return /[?&]preview=1(&|$)/.test(window.location.search);
  }

  /**
   * The first placed input of one kind.
   * @param which "username" or "password"
   * @return the input element, or null
   * @note "First" rather than by id, because a ta can delete the seeded box
   * and add their own, or end up with two - topmost wins, as elsewhere.
   */
  function inputFor(which) {
    return document.querySelector('[data-login-input="' + which + '"]');
  }

  /**
   * Shows one of the failure line's two strings, or hides the line.
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
   * Hides a box's greyed placeholder once something's been typed into it.
   * @param input a [data-login-input] element
   * @note The placeholder is a real editable field over the input, not the
   * input's placeholder attribute, so a ta can restyle it - which makes its
   * visibility ours to manage.
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
        /* fresh start for the idle clock: a stale timestamp from an old
           visit would log the new session straight back out */
        localStorage.setItem("last_active", String(Date.now()));
        window.location.href = data.role === "ta" ? "instructor.html" : "dashboard.html";
      })
      .catch(function () { showError("bad"); });
  }

  /**
   * Brings the placed elements up to date: placeholder visibility per box,
   * and the "you were idled out" line if that's why we're here.
   * @note Called by main.js once the elements exist, and again whenever a ta
   * places a new one - the same window.-hook convention renderDays uses.
   */
  function refreshLoginPage() {
    document.querySelectorAll("[data-login-input]").forEach(syncPlaceholder);
    /* only on the real page: inside the editor the failure line always shows
       both strings at once so a ta can edit them (see css/style.css) */
    if (!inEditor() && /[?&]expired=1(&|$)/.test(window.location.search)) showError("expired");
  }

  /**
   * Last-resort form for when /api/content is unreachable, so an outage in
   * the content api can't lock everyone out of a working site.
   * @note Plain markup carrying the same data-login-* markers as the placed
   * elements, so it behaves like the real thing minus a ta's saved styling.
   */
  function buildLoginFallback() {
    if (document.querySelector("[data-login-input]")) return;
    /* one piece per anchor, not all four in the first: the captions are
       ordinary markup sitting between the anchors, so piling every field
       into the username slot strands the password caption below the form */
    var slots = [
      /* real placeholder attributes here, unlike the placed elements' own
         editable placeholder spans - nothing builds those on this path, and
         an empty grey box with no hint is the wrong thing to hand someone
         already looking at a half-broken page */
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
      /* the spacer held a slot open for an absolutely-positioned element;
         what just went in is in-flow and takes its own room, so leaving it
         would double the gap under every field */
      anchor.style.display = "none";
    });
    refreshLoginPage();
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest('[data-login-el="submit"]');
    if (!btn) return;
    /* inEditor() already stops the post; this just keeps a real <button>
       from doing anything of its own on top of that */
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

  /* `change` alongside `input` because the two do not overlap as much as they
     look: picking an entry out of the browser's own credential dropdown commits
     a value with a change and no input at all. */
  ["input", "change"].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      var input = e.target;
      if (input && input.hasAttribute && input.hasAttribute("data-login-input")) syncPlaceholder(input);
    });
  });

  /* the two ways a value arrives that fire NEITHER of those, both of which
     left the greyed placeholder sitting on top of a filled box:

     the browser autofilling on load - silent by design, and reachable only
     through the animation css/style.css hangs on :-webkit-autofill for exactly
     this purpose;

     and the browser restoring what was typed before across a navigation - a
     reload, the back button, or the redirect to ?expired=1 that this page's own
     idle timeout performs, which is how a visitor actually meets it. Restoration
     finishes before pageshow, so one re-sync there covers all of them, and it
     costs a class toggle on two inputs. */
  document.addEventListener("animationstart", function (e) {
    if (e.animationName !== "login-autofilled") return;
    var input = e.target;
    if (input && input.hasAttribute && input.hasAttribute("data-login-input")) syncPlaceholder(input);
  }, true);
  window.addEventListener("pageshow", function () {
    document.querySelectorAll("[data-login-input]").forEach(syncPlaceholder);
  });

  window.refreshLoginPage = refreshLoginPage;
  window.buildLoginFallback = buildLoginFallback;
  document.addEventListener("DOMContentLoaded", refreshLoginPage);
})();
