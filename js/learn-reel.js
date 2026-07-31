/* every reel on the page (see addCustomElement()'s "reel" kind in
   js/main.js): drifts on its own along its orientation's axis, and homes in
   on whichever tile the pointer is over (speeding up to bring it fully on
   screen first, if it's still entering) instead of just pausing dead.

   The idle drift itself runs as a Web Animation (track.animate()), not a
   rAF loop: a plain rAF-driven translate visibly sped up while the mouse
   moved and went chunky/laggy at rest, because the browser (Windows Chrome
   in particular) throttles how often it calls back into main-thread JS -
   including rAF - once there's been no recent input, as a power-saving
   measure. A Web Animation's steady linear keyframe runs on the compositor
   instead, so it keeps its own real-world pace regardless of how the main
   thread is being throttled. rAF is still used, but only for the brief,
   input-driven homing/hold phase while a tile is actually moused over -
   exactly when the browser guarantees full-rate callbacks anyway.

   In the ta editor, autoplay/hover-pop would fight editing, so a reel shows
   a real, manually-driven scrollbar instead (see initReel()'s editorStatic
   branch) over the plain, un-cloned set of tiles - no looping, just a hard
   stop at either end like any other scrollable list in the editor.

   initAllReels() is called by js/main.js once fetchContent() has finished
   applying every text/size/position/hidden override for the load, so every
   reel's tiles (and whatever a ta has bound into them) are already in their
   final state (see the call sites next to applyLockHighlight() in
   main.js). It's a plain global function, not wired to DOMContentLoaded
   itself, for exactly that reason: racing the fetch would clone stale
   placeholder content into the loop's extra copies. */

/**
 * Sets up (or, in the reduced-motion case, skips) one reel's drift/scroll
 * behavior. Safe to call more than once on the same reel - only the first
 * call does anything, since a second content load never actually changes
 * an already-built reel's markup.
 * @param wrap the reel's panel element (.reel)
 */
function initReel(wrap) {
  var track = wrap.querySelector(".reel-track");
  if (!track || track.dataset.reelInit) return;
  track.dataset.reelInit = "1";

  var vertical = wrap.classList.contains("reel--vertical");
  var axis = vertical ? "Y" : "X";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* the object mini editor (templates/object-editor.html, ?object=1) reuses
     this exact same editing engine against its own blank canvas instead of
     a real page (see isObjectMode()'s doc comment in main.js) - autoplay/
     hover-pop would fight editing there exactly the same way it would on
     the real page, so it gets the manual-scroll mode too */
  var editorStatic = (isPreviewMode() && isEditMode()) || isObjectMode();

  /* reduced motion wins over the editor's own manual-scroll mode below: a
     drifting or scroll-wrapped reel with no static fallback would just be
     motion a reduced-motion visitor didn't ask for either way, ta editor
     included - falls back to the original static grid, every tile visible
     and selectable at once, no scrolling at all. */
  if (reducedMotion) {
    wrap.classList.add("static-grid");
    /* the static grid's CSS sizes tiles via its own grid columns
       (css/style.css's .reel.static-grid .reel-tile), but an inline style
       (set at build time, see buildReelElement() in main.js) always beats a
       stylesheet rule regardless of selector, so it has to be cleared here */
    Array.prototype.forEach.call(track.querySelectorAll(".reel-tile"), function (t) {
      t.style.width = "";
      t.style.height = "";
    });
    return;
  }

  if (editorStatic) {
    /* plain, single set of tiles, scrolled manually - no cloned loop buffer
       and no wrap-around snap back to the other end. That trick reads
       naturally on a live, autoplaying reel (see below), but a ta
       deliberately scrolling through tiles to inspect/edit them doesn't
       expect the strip to loop out from under them, and a hard stop at
       either end is exactly what every other scrollable list in the editor
       already does. */
    wrap.classList.add("reel--editor-scroll");
    return;
  }

  var originalCount = track.children.length;
  var REPEATS = 4; /* enough spare track that a fast hover-home never runs it dry */
  for (var r = 1; r < REPEATS; r++) {
    for (var i = 0; i < originalCount; i++) {
      var clone = track.children[i].cloneNode(true);
      stripTrackedAttrs(clone);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    }
  }

  var firstTile = track.children[0];
  var lastOriginalTile = track.children[originalCount - 1];
  var setSpan = 0;
  var mask = wrap.querySelector(".reel-mask");

  /** Remeasures how far one full set of tiles (+ its trailing gap) spans, along the reel's own axis, for the drift loop. */
  function measure() {
    var trackStyle = getComputedStyle(track);
    var gap = parseFloat(vertical ? (trackStyle.rowGap || trackStyle.gap) : (trackStyle.columnGap || trackStyle.gap)) || 0;
    setSpan = vertical ?
      (lastOriginalTile.offsetTop + lastOriginalTile.offsetHeight) - firstTile.offsetTop + gap :
      (lastOriginalTile.offsetLeft + lastOriginalTile.offsetWidth) - firstTile.offsetLeft + gap;
  }
  measure();

  var baseSpeed = 88; /* px/sec */
  var HOMING_RATE = 9; /* per-second ease-toward-target rate, see homing tick() below */
  var anim = null; /* the compositor-driven idle-drift Web Animation, while not hovering any tile */
  var rafId = null; /* the input-driven homing/hold rAF loop, while hovering one */
  var hoverPos = 0; /* pos, but only meaningful while rafId owns it (see onEnter/tick/onLeave) */

  /** @return current drift position (px scrolled into the loop), read from the compositor animation. */
  function driftPos() {
    if (!anim || setSpan <= 0) return 0;
    var dur = (setSpan / baseSpeed) * 1000;
    var ct = anim.currentTime || 0;
    return ((ct % dur) + dur) % dur / dur * setSpan;
  }

  /**
   * (Re)starts the idle drift as a fresh looping Web Animation, picking up
   * from `fromPos` instead of restarting at 0 - so handing back off from a
   * hover doesn't visibly jump.
   * @param fromPos px into the loop to resume from
   */
  function startDrift(fromPos) {
    if (anim) anim.cancel();
    if (setSpan <= 0) return;
    var dur = (setSpan / baseSpeed) * 1000;
    anim = track.animate(
      [{ transform: "translate" + axis + "(0px)" }, { transform: "translate" + axis + "(" + (-setSpan) + "px)" }],
      { duration: dur, iterations: Infinity, easing: "linear" }
    );
    anim.currentTime = ((fromPos % setSpan) + setSpan) % setSpan / setSpan * dur;
  }

  startDrift(0);

  window.addEventListener("resize", function () {
    var resumeFrom = rafId ? null : driftPos(); /* mid-hover: measure() alone is enough, the rAF loop owns pos */
    measure();
    if (resumeFrom !== null) startDrift(resumeFrom);
  });

  /**
   * Starts homing the drift toward fully revealing `el` (or just freezes in
   * place if it's already fully on screen), and pops it up visually. Hands
   * control from the idle Web Animation to a rAF loop for the duration of
   * the hover - see this file's top doc comment for why the split exists.
   * @param el the hovered tile
   */
  function onEnter(el) {
    hoverPos = driftPos();
    if (anim) { anim.cancel(); anim = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    var maskRect = mask.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    var margin = 24;
    var overflow = vertical ?
      elRect.bottom - (maskRect.bottom - margin) :
      elRect.right - (maskRect.right - margin);
    var targetPos = overflow > 0 ? hoverPos + overflow : hoverPos;
    el.classList.add("popped");

    var lastTime = null;
    function tick(time) {
      if (lastTime === null) lastTime = time;
      var dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      var dist = targetPos - hoverPos;
      if (Math.abs(dist) < 0.4) hoverPos = targetPos;
      else hoverPos += dist * Math.min(1, HOMING_RATE * dt);

      track.style.transform = "translate" + axis + "(" + (-hoverPos) + "px)";
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  /** Un-pops `el` and hands the drift back to a fresh Web Animation from wherever the hover left off. */
  function onLeave(el) {
    el.classList.remove("popped");
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    startDrift(hoverPos);
  }

  Array.prototype.forEach.call(track.querySelectorAll(".reel-tile"), function (el) {
    el.addEventListener("mouseenter", function () { onEnter(el); });
    el.addEventListener("mouseleave", function () { onLeave(el); });
  });
}

/** Sets up every reel currently on the page - see initReel(). */
function initAllReels() {
  document.querySelectorAll(".reel").forEach(function (wrap) { initReel(wrap); });
}

/**
 * Strips every data-edit-id/data-resize-id (and plain id) off `el` and its
 * descendants, so a cloned repeat of a tile (and whatever a ta has bound
 * into it) never fights the original over the visual editor's click-to-
 * edit/resize wiring - it's a purely visual echo used to fill out the
 * reel's loop.
 * @param el the cloned tile root
 */
function stripTrackedAttrs(el) {
  el.removeAttribute("data-edit-id");
  el.removeAttribute("data-resize-id");
  el.removeAttribute("id");
  el.querySelectorAll("[data-edit-id], [data-resize-id], [id]").forEach(function (child) {
    child.removeAttribute("data-edit-id");
    child.removeAttribute("data-resize-id");
    child.removeAttribute("id");
  });
}
