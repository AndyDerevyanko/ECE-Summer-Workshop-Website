/* every reel on the page (see addCustomElement()'s "reel" kind in
   js/main.js): drifts on its own along its orientation's axis, and homes in
   on whichever tile the pointer is over (bringing it fully on screen first
   if it's hanging off either end - speeding up for one still entering,
   winding back for one already leaving) instead of just pausing dead.

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
  /* enough spare track that a fast hover-home never runs it dry at EITHER end:
     three sets ahead of the resting position, and the one behind it that
     onEnter()'s wind-back borrows from (see trackTransform()) */
  var REPEATS = 5;
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
   * The track's transform for a given drift position. It rests one whole tile
   * set further along than the position alone implies, which parks it on the
   * second copy rather than the first - invisible, since every copy is
   * identical, and what it buys is a full set of track BEHIND the drift for
   * onEnter()'s wind-back to borrow from. Without that spare set the wind-back
   * had to stop at the loop's origin (nothing but blank track lies before it),
   * so a tile hovered while the drift sat near that origin came only part of
   * the way back into view - or, with nothing left to give, never moved.
   * @param pos px scrolled into the loop
   * @return the translate() for this reel's own axis
   */
  function trackTransform(pos) {
    return "translate" + axis + "(" + (-(pos + setSpan)) + "px)";
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
      [{ transform: trackTransform(0) }, { transform: trackTransform(setSpan) }],
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
   *
   * Works on BOTH edges of the mask, symmetrically: a tile still entering
   * (hanging off the far edge) is pulled the rest of the way in by speeding
   * the drift up, and a tile on its way out (already half past the near edge)
   * is brought back on by running the drift BACKWARDS the same amount - so
   * hovering anything half-visible reads the same way round either end,
   * rather than only being readable on the side it entered from.
   * @param el the hovered tile
   */
  function onEnter(el) {
    /* driftPos() only means anything while the Web Animation owns the track -
       mid-hover hoverPos is already the live figure, and reading it from a
       cancelled anim would snap the position back to 0 */
    if (anim) hoverPos = driftPos();
    /* pin the track to where the drift has actually reached BEFORE handing
       over. cancel() drops the animation's transform out of the computed style
       at once, so without this the measurements below read the tile at
       whatever stale inline transform the LAST hover left behind (or at the
       loop's origin, on the first hover of all) rather than where it visibly
       is. That gap - however far the drift had travelled since - was being
       subtracted from the wind-back, which is why it landed short by a varying
       amount, and skipped entirely once the gap exceeded the overhang itself.
       It flattered the forward homing for the same reason: there the same gap
       is ADDED, and overshooting still leaves the tile fully on screen. */
    track.style.transform = trackTransform(hoverPos);
    if (anim) { anim.cancel(); anim = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    var maskRect = mask.getBoundingClientRect();
    /* the tile is placed from layout offsets against the track's own rect
       rather than read off its bounding rect, because a tile still easing out
       of a previous hover's scale(1.08) (.reel-tile.popped, a .32s transition,
       css/style.css) measures up to 4% of its width too big on each side
       mid-flight. The track only ever carries a translate, so its rect is
       safe to anchor to. */
    var trackRect = track.getBoundingClientRect();
    var tileStart = vertical ?
      trackRect.top + (el.offsetTop - track.offsetTop) :
      trackRect.left + (el.offsetLeft - track.offsetLeft);
    var tileEnd = tileStart + (vertical ? el.offsetHeight : el.offsetWidth);
    /* matches the mask-image stop on .reel-mask (css/style.css): a tile parked
       inside that band is on screen but still visibly faded out by the mask,
       which reads as "not all the way back" to anyone looking at it. The mask
       has no padding along its scroll axis, so its border box is the edge the
       fade is measured from either way round. */
    var margin = 64;
    /* how far past the edge the tile hangs, on the side the drift is carrying
       tiles TOWARD (bottom/right) and on the side it's carrying them AWAY
       from (top/left). Only one can be positive unless the tile is bigger
       than the mask itself, in which case the near edge wins below: reading
       one starts at its beginning. */
    var overflow = tileEnd - ((vertical ? maskRect.bottom : maskRect.right) - margin);
    var underflow = ((vertical ? maskRect.top : maskRect.left) + margin) - tileStart;
    var targetPos = hoverPos;
    if (underflow > 0) targetPos = hoverPos - underflow;
    else if (overflow > 0) targetPos = hoverPos + overflow;
    el.classList.add("popped");

    var lastTime = null;
    function tick(time) {
      if (lastTime === null) lastTime = time;
      var dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      var dist = targetPos - hoverPos;
      if (Math.abs(dist) < 0.4) hoverPos = targetPos;
      else hoverPos += dist * Math.min(1, HOMING_RATE * dt);

      track.style.transform = trackTransform(hoverPos);
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
