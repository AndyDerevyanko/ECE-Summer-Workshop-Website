"""sqlite connection + schema. users table holds hashed login credentials,
content table holds the TA-editable site content (day panels, extras, timer)."""

import json
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.security import generate_token, hash_password, verify_password

try:
    from app.seed_accounts import SEED_STUDENTS, SEED_TAS
except ImportError:
    # gitignored file missing (fresh clone), no accounts get seeded
    SEED_STUDENTS, SEED_TAS = {}, {}

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "app.db"
UPLOAD_DIR = BASE_DIR / "data" / "uploads"

# sliding idle windows per role, pushed forward on every authenticated
# request (tas also heartbeat from an open tab, see js/idle.js). tas hold
# the editing keys so they idle out fast; students only lose the dashboard
# so they get a lazier window. matches IDLE_LIMIT_MS in js/idle.js.
TA_IDLE_SECONDS = 20 * 60
STUDENT_IDLE_SECONDS = 4 * 60 * 60


def _idle_seconds(role):
    """the sliding idle window for a role.
    @param role "ta" or "student"
    @return seconds of inactivity before the session expires
    """
    return TA_IDLE_SECONDS if role == "ta" else STUDENT_IDLE_SECONDS

# ids that default to "fixed" in the visual editor (always stacked above
# every non-fixed element, and shown with the red "this is fixed" hitbox in
# edit mode, see applyLayerOrder()/toggleFixed()/applyFixedHighlight() in
# js/main.js): the sticky <nav> itself plus everything inside it, so the
# whole nav bar reads as promoted, not just its outer box. matches the
# data-edit-id/data-resize-id values on templates/index.html's <nav>.
NAV_FIXED_IDS = [
    "box.nav", "box.brand", "img.brand.nav", "nav.brand",
    "nav.link.about", "nav.link.gallery", "nav.link.learn",
    "nav.link.schedule", "nav.link.prizes", "nav.link.apply",
    "nav.portal", "box.themeBtn", "box.logoutBtn",
]

# the "What You'll Learn" section's reel (see the "reel" custom-element kind
# in js/main.js): used to be hardcoded markup in templates/index.html, now a
# real placed reel like a ta could build themselves, so it's deletable/
# resizable/recolorable and its tiles can have new content dropped onto
# them. Reuses the exact same icon.learn.cardN / learn.cardN.title /
# learn.cardN.body ids the old markup carried, so every override a ta
# already made via click-to-edit (font size, color, text, ...) keeps
# resolving against the same id and applies with zero data transformation -
# see _learn_reel_overlay()/_migrate_learn_reel() below. Icon markup mirrors
# ICON_LIBRARY's "Circuit"/"Component"/"Soldering iron"/"Chip"/"Cube"/"Flag"
# entries in js/main.js (the old markup's own icons, just inlined here since
# this is python, not js).
_LEARN_REEL_ICONS = [
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h3" /><path d="M19 12h3" />'
    '<path d="M5 12c2-7 4-7 6 0s4 7 6 0" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h6" /><path d="M21 12h-6" />'
    '<path d="M9 7l6 5-6 5z" /><path d="M15 7v10" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 7l4 4L7 21H3v-4z" />'
    '<path d="M15 5l2-2 4 4-2 2" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" />'
    '<path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z" />'
    '<path d="M12 12l9-5M12 12v10M12 12L3 7" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v18" /><path d="M6 4h13v8H6z" />'
    '<path d="M6 4h4.3v4H6zM14.7 4H19v4h-4.3zM10.3 8h4.4v4h-4.4z" fill="currentColor" stroke="none" /></svg>',
]

_LEARN_REEL_CARDS = [
    {"title": "Electronics & Circuit Design", "body": "Build and debug real circuits using oscilloscopes, multimeters, function generators, and power supplies. Learn circuit analysis, prototyping, testing, and troubleshooting techniques."},
    {"title": "Transistors, Diodes, Capacitors & Inductors", "body": "Learn how fundamental electronic components work, giving you a head start in 2nd-year courses like ECE231 and ECE212."},
    {"title": "Soldering & PCB Assembly", "body": "Learn professional soldering techniques, component placement, rework, and PCB assembly."},
    {"title": "Embedded Systems", "body": "Program an Arduino-compatible microcontroller to read sensors, generate signals, control motors, and talk to external hardware."},
    {"title": "CAD & 3D Printing", "body": "Learn the basics of Fusion 360 and 3D printing to design, manufacture, and assemble your own robot."},
    {"title": "Robotics Competition", "body": "Bring your robot to life and race it head-to-head against the rest."},
]


def _learn_reel_overlay():
    """builds the migrated "What You'll Learn" reel's custom-element entry
    plus the flat per-id override maps (text/font_sizes/text_styles/colors)
    its tiles' bound children need to look/read right - see
    _LEARN_REEL_ICONS/_LEARN_REEL_CARDS above. Position/tile size are a
    one-time approximation eyeballed against the live rendered page at a
    1280px viewport (the old section's own heading-to-video-row gap), not
    analytically derived - a ta can drag/resize it like anything else if a
    narrower viewport leaves it looking off; see the reserved min-height
    left in its place in templates/index.html so the video row below it
    doesn't collide with it in the meantime.
    @return (entry, text, font_sizes, text_styles, colors)
    """
    tiles = []
    text, font_sizes, text_styles, colors = {}, {}, {}, {}
    for i, card in enumerate(_LEARN_REEL_CARDS, start=1):
        icon_id = "icon.learn.card%d" % i
        title_id = "learn.card%d.title" % i
        body_id = "learn.card%d.body" % i
        tiles.append({
            "id": "learn.reel.tile.%d" % (i - 1),
            "children": [
                {"id": icon_id, "kind": "icon", "left": 20, "top": 22, "icon": _LEARN_REEL_ICONS[i - 1]},
                {"id": title_id, "kind": "text", "left": 58, "top": 24, "w": 240, "h": 46},
                {"id": body_id, "kind": "text", "left": 20, "top": 80, "w": 280, "h": 130},
            ],
        })
        text[title_id] = card["title"]
        text[body_id] = card["body"]
        # 1.05rem/var(--font-head) matches the old .card h3's own rule (see
        # css/style.css); "text" kind text_styles has no bold control, so
        # this is an approximation, not pixel-identical to the old markup
        font_sizes[title_id] = "1.05rem"
        text_styles[title_id] = {"fontFamily": "var(--font-head)"}
        colors[body_id] = "var(--muted)"
    entry = {
        "id": "learn.reel", "kind": "reel", "orientation": "horizontal",
        "left": 80, "top": 1888, "tileW": 320, "tileH": 230,
        # explicit panel size, unlike a freshly-placed reel (which freezes
        # at its own just-rendered pre-clone size, see addCustomElement()):
        # this entry is built once at page load already past the point
        # js/learn-reel.js has cloned it 4x for the loop (renderCustomElements()
        # runs before initAllReels(), see the call order in main.js), so
        # without an explicit width here the panel would size itself to fit
        # all 24 cloned tiles unclipped instead of acting as a proper
        # scrolling/drifting viewport - see initReel().
        "w": 1160, "h": 230,
        "tiles": tiles,
    }
    return entry, text, font_sizes, text_styles, colors


(_LEARN_REEL_ENTRY, _LEARN_REEL_TEXT, _LEARN_REEL_FONT_SIZES,
 _LEARN_REEL_TEXT_STYLES, _LEARN_REEL_COLORS) = _learn_reel_overlay()

# starting content, same shape as the old hardcoded DAYS/EXTRAS/timer vars.
# only used the first time the content table is empty.
DEFAULT_CONTENT = {
    "total_days": 10,
    "days": [
        {"day": 1, "date": "", "opens_at": "", "unlocked": False, "title": "", "blurb": "", "files": []},
        {"day": 2, "date": "", "opens_at": "", "unlocked": False, "title": "", "blurb": "", "files": []},
    ],
    "extras": [],
    "timer_mode": "tentative",
    "timer_target": "",
    "join_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "apply_tooltip": "Applications open once the workshop dates are confirmed, check back soon.",
    "hero_video_url": "assets/cover-video.mp4",
    # landing page photos (about section + certificate), staff-replaceable
    # from the content manager's "Site images" section, see js/ta.js.
    "home_images": {
        "about_hero": "assets/gallery/group-main-alt.jpeg",
        "about_1": "assets/gallery/class-closeup.jpeg",
        "about_2": "assets/gallery/robot-closeup.png",
        "about_3": "assets/gallery/class-2.jpeg",
        "certificate": "assets/certificate.png",
    },
    "logistics": [
        {"big": "2 weeks", "lbl": "Tentative start date", "icon": False},
        {"big": "4 hours", "lbl": "1:30pm–5:30pm", "icon": False},
        {"big": "SFB520", "lbl": "Sandford Fleming", "icon": False},
        {"big": "", "lbl": "Certificate of completion", "icon": True},
    ],
    "gallery": {
        "years": ["2026", "2025"],
        "images": {
            "2026": [
                "assets/gallery/group-main-2026.png",
                "assets/gallery/robots-moving.MOV",
                "assets/gallery/robot-moving.MOV",
                "assets/gallery/alumni-conference.png",
                "assets/gallery/class-2.jpeg",
                "assets/gallery/class-3.jpeg",
                "assets/gallery/class-4.jpeg",
                "assets/gallery/class-5.jpeg",
                "assets/gallery/class-closeup-2.jpeg",
                "assets/gallery/class-closeup-3.jpeg",
                "assets/gallery/class-closeup-4.jpeg",
                "assets/gallery/class-closeup.jpeg",
                "assets/gallery/class.png",
                "assets/gallery/group-main-alt-2.jpeg",
                "assets/gallery/group-main-alt-3.jpeg",
                "assets/gallery/group-main-alt-4.jpeg",
                "assets/gallery/group-main-alt-5.jpeg",
                "assets/gallery/group-main-alt.jpeg",
                "assets/gallery/hamid-2.png",
                "assets/gallery/hamid-3.png",
                "assets/gallery/hamid-4.png",
                "assets/gallery/hamid-5.png",
                "assets/gallery/hamid-6.png",
                "assets/gallery/hamid.png",
                "assets/gallery/people-2.png",
                "assets/gallery/people-looking.png",
                "assets/gallery/people-track.JPG",
                "assets/gallery/people.png",
                "assets/gallery/prizes-1.png",
                "assets/gallery/prizes-2.png",
                "assets/gallery/prizes-3.png",
                "assets/gallery/prizes-4.png",
                "assets/gallery/prizes-5.png",
                "assets/gallery/prizes-6.png",
                "assets/gallery/prizes-7.png",
                "assets/gallery/prizes-8.png",
                "assets/gallery/prizes-9.png",
                "assets/gallery/prizes-10.png",
                "assets/gallery/random.jpeg",
                "assets/gallery/robot-closeup-2.png",
                "assets/gallery/robot-closeup-3.png",
                "assets/gallery/robot-closeup-4.png",
                "assets/gallery/robot-closeup-5.png",
                "assets/gallery/robot-closeup.png",
                "assets/gallery/robot-on-track-2.png",
                "assets/gallery/robot-on-track-3.png",
                "assets/gallery/robot-on-track-closeup.png",
                "assets/gallery/robot-on-track.png",
                "assets/gallery/robot-super-closeup.png",
                "assets/gallery/seraj.png",
                "assets/gallery/track-2.png",
                "assets/gallery/track-3.png",
                "assets/gallery/track-far-shot-2.JPG",
                "assets/gallery/track-far-shot.png",
                "assets/gallery/track-from-far-2.png",
                "assets/gallery/track-from-far.png",
                "assets/gallery/track-photo.png",
                "assets/gallery/wide-angle-room.png",
                "assets/gallery/runner-up.MOV",
            ],
            "2025": [
                "assets/gallery/group_photo_2025.jpg",
                "assets/gallery/hand_crank_joule_thief_2025.MOV",
                "assets/gallery/robot_in_action_2025.MOV",
                "assets/gallery/workshop_happening_2025.jpg",
            ],
        },
    },
    # click-to-edit overrides for hardcoded landing page copy, keyed by the
    # data-edit-id on the element in templates/index.html. empty means "show
    # the page's own default text".
    "text": {},
    # resize-handle drags in the visual editor, keyed by data-edit-id (text
    # boxes) or data-resize-id (images/icons), {id: {w, h}} in css px.
    "sizes": {},
    # A-/A+ font-size bumps in the visual editor, keyed by data-edit-id, css
    # px string.
    "font_sizes": {},
    # text toolbar's font/align/letter-spacing, keyed by data-edit-id,
    # {id: {fontFamily, align, letterSpacing}}.
    "text_styles": {},
    # move-handle drags in the visual editor, text fields only, keyed by
    # data-edit-id, {id: {x, y}} left/top offsets in css px.
    "positions": {},
    # elements deleted in the visual editor, a flat list of data-edit-id/
    # data-resize-id values to hide.
    "hidden": [],
    # elements added in the visual editor's right-click "Add element" menu,
    # not present in the template at all, {id, kind, left, top, w, h, icon,
    # href}, see renderCustomElements() in js/main.js.
    "custom_elements": [],
    # visual editor stacking order, ordered ids bottom to top, see
    # applyLayerOrder()/moveLayer() in js/main.js.
    "layers": [],
    # ids "promoted to navbar", always stacked above every non-fixed
    # element regardless of layer order, see toggleFixed() in js/main.js.
    # defaults to the nav bar and everything inside it.
    "fixed_elements": list(NAV_FIXED_IDS),
    # visual editor style popover's color picker, keyed by data-edit-id/
    # data-resize-id, a css color string. text color, icon color, or
    # background color depending on the element, see setElementColor() in
    # js/main.js.
    "colors": {},
    # visual editor style popover's opacity slider, keyed by data-edit-id/
    # data-resize-id, a number 0-1.
    "opacity": {},
    # ids locked against being moved in the visual editor (right-click >
    # Lock element), see toggleLocked() in js/main.js. a flat list, same
    # shape as fixed_elements.
    "locked": [],
    # elements duplicated in the visual editor's right-click "Duplicate"
    # option, {sourceId, suffix} pairs: the duplicate's own id is always
    # sourceId+suffix, reconstructed on every load by re-cloning whatever
    # sourceId currently renders as, see renderDuplicates() in js/main.js.
    "duplicates": [],
    # visual editor style popover's Fill control, keyed by data-edit-id.
    # a textbox's own background surface, separate from its font color
    # (content.colors), see applyFillOverrides() in js/main.js.
    "fill": {},
    # visual editor style popover's Radius slider, keyed by data-edit-id/
    # data-resize-id, a whole-number px value.
    "radius": {},
    # visual editor style popover's Border row, keyed by data-edit-id/
    # data-resize-id, {w, color}.
    "border": {},
    # ids with the shared drop-shadow (style popover's Shadow checkbox)
    # turned on, a flat list, same shape as fixed_elements/locked.
    "shadow": [],
    # right-click "Add link"/"Edit link" targets, keyed by data-edit-id/
    # data-resize-id, a url string. a real <a> (a button, the brand link)
    # gets a real href; anything else gets a navigate-on-click listener,
    # see applyOneLink() in js/main.js.
    "links": {},
    # visual editor style popover's Text color row, buttons only, keyed by
    # data-edit-id. a button's own Color row already means its background
    # (see colorTarget() in js/main.js), this is the separate control for
    # its label.
    "text_color": {},
    # visual editor style popover's "Change icon" row, theme toggles only
    # (the nav's own #themeBtn, or a placed "theme" custom element), keyed
    # by data-resize-id, raw <svg>/<img> markup. empty means "show the
    # default sun/moon swap", see applyThemeIconOverrides() in js/main.js.
    "theme_icons": {},
    # dark-mode overrides for the four maps above (colors/text_color/fill/
    # border), same keys, each optional: an id present here wins over the
    # auto-computed dark variant (autoDarkVariant() in js/main.js flips the
    # light color's hsl lightness) whenever [data-theme="dark"], see
    # resolveThemedColor()/the style popover's "dark mode color" toggles in
    # js/main.js. an id with no entry here still gets the auto variant, it's
    # never left at its literal light-mode color in dark mode.
    "dark_colors": {},
    "dark_text_color": {},
    "dark_fill": {},
    "dark_border": {},
}
DEFAULT_CONTENT["custom_elements"].append(_LEARN_REEL_ENTRY)
DEFAULT_CONTENT["text"].update(_LEARN_REEL_TEXT)
DEFAULT_CONTENT["font_sizes"].update(_LEARN_REEL_FONT_SIZES)
DEFAULT_CONTENT["text_styles"].update(_LEARN_REEL_TEXT_STYLES)
DEFAULT_CONTENT["colors"].update(_LEARN_REEL_COLORS)

# starter "objects" library entries (see the objects table below): reusable
# element bundles a ta can drop onto the page from the visual editor's
# right-click "Add element" > "Object" picker (see placeObject() in
# js/main.js). Each is authored from scratch as its own small
# custom_elements bundle (same shape content.custom_elements already uses),
# not derived from anything already tagged on index.html, so seeding this
# can never change how the real page's own elements are tagged/grouped.
# the seeded "Navbar" bundle in particular carries no fixed_elements entry
# at all (placeObject() never copies one across anyway, it isn't one of the
# maps it remaps), so a placed copy is a normal, freely-movable group, never
# auto-promoted the way the real live nav is.
DEFAULT_OBJECTS = [
    {
        "name": "Logistics tile",
        "data": {
            # matches the real .card.stat tiles (css/style.css): surface
            # background, --font-mono accent-colored big number, muted label,
            # both centered, same as the dashboard/landing page's own tiles,
            # not just a generic box+text guess.
            "custom_elements": [
                {"id": "seed.tile.box", "kind": "box", "left": 0, "top": 0, "w": 200, "h": 140},
                {"id": "seed.tile.big", "kind": "text", "left": 30, "top": 28, "w": 140, "h": 50},
                {"id": "seed.tile.lbl", "kind": "text", "left": 20, "top": 86, "w": 160, "h": 26},
            ],
            "text": {
                "seed.tile.big": "2 weeks",
                "seed.tile.lbl": "Tentative start date",
            },
            # measured against the real classes: --font-mono 1.9rem "2 weeks"
            # is 124.7x48.6 (.stat .big), default .9rem "Tentative start
            # date" is 131.1x23 (.stat .lbl). too-short boxes here used to
            # bisect the text with the always-on dashed outline or wrap a
            # line straight past the tile's own bottom edge.
            "font_sizes": {"seed.tile.big": "1.9rem", "seed.tile.lbl": ".9rem"},
            "text_styles": {
                "seed.tile.big": {"fontFamily": "var(--font-mono)", "align": "center"},
                "seed.tile.lbl": {"align": "center"},
            },
            "colors": {
                "seed.tile.big": "var(--accent)", "seed.tile.lbl": "var(--muted)",
                "seed.tile.box": "var(--surface)",
            },
            "radius": {"seed.tile.box": 14},
            "groups": [["seed.tile.box", "seed.tile.big", "seed.tile.lbl"]],
        },
    },
    {
        "name": "Countdown timer",
        "data": {
            # a composite of individually-editable parts, not one monolith,
            # but the countdown itself is ONE datetime element (kind
            # "datetime", format "countdown"), not split into a piece per
            # unit, its own strftime pattern (left blank here, falls back to
            # DT_DEFAULT_PATTERNS.countdown in js/main.js) prints all 4 units
            # in one ticking string. Alongside it: a surface card, a
            # "COUNTING DOWN" eyebrow, and one "DAYS   HRS   MIN   SEC"
            # label row underneath, all grouped so they move as one but
            # each stays independently editable (font, size, color, align,
            # and, for the datetime part, its own format/pattern via the
            # style popover). The datetime part's target is filled in at
            # seed time (see _seed_default_objects()), 30 days out from
            # whenever the db is first created, since a hardcoded date here
            # would eventually sit in the past.
            "custom_elements": [
                {"id": "seed.cd.box", "kind": "box", "left": 0, "top": 0, "w": 440, "h": 156},
                {"id": "seed.cd.eyebrow", "kind": "text", "left": 24, "top": 18, "w": 250, "h": 20},
                {"id": "seed.cd.dt", "kind": "datetime", "left": 24, "top": 50, "w": 392, "h": 48, "format": "countdown", "strftime": "", "target": None},
                {"id": "seed.cd.lbl", "kind": "text", "left": 24, "top": 104, "w": 392, "h": 20},
            ],
            "text": {
                "seed.cd.eyebrow": "COUNTING DOWN",
                # wide gaps (not the datetime element's own 2-space ones):
                # the label renders much smaller than the digits (.7rem vs
                # 2rem) so it needs proportionally wider spaces to land each
                # word's center under its matching digit group, see the
                # white-space: pre rule for [data-edit-id^="seed.cd.lbl"]
                # in css/style.css, without which this collapses to single
                # spaces and the words bunch up with no alignment at all.
                "seed.cd.lbl": "DAYS" + " " * 9 + "HRS" + " " * 9 + "MIN" + " " * 9 + "SEC",
            },
            "font_sizes": {
                "seed.cd.eyebrow": ".75rem",
                "seed.cd.dt": "2rem",
                "seed.cd.lbl": ".7rem",
            },
            "text_styles": {
                "seed.cd.eyebrow": {"fontFamily": "var(--font-mono)", "letterSpacing": "2px"},
                "seed.cd.dt": {"fontFamily": "var(--font-mono)", "align": "center", "letterSpacing": "4px"},
                "seed.cd.lbl": {"fontFamily": "var(--font-mono)", "align": "center", "letterSpacing": "1px"},
            },
            "colors": {
                "seed.cd.box": "color-mix(in srgb, var(--surface) 75%, transparent)",
                "seed.cd.eyebrow": "var(--accent)",
                "seed.cd.dt": "var(--accent)",
                "seed.cd.lbl": "var(--muted)",
            },
            "radius": {"seed.cd.box": 14},
            "groups": [[
                "seed.cd.box", "seed.cd.eyebrow", "seed.cd.dt", "seed.cd.lbl",
            ]],
        },
    },
    {
        "name": "Navbar",
        "data": {
            # a real replica of the site's own nav (templates/index.html),
            # not a 2-link placeholder: the actual logo file, the actual
            # wordmark, all 6 real nav links (About/Gallery/What you'll
            # learn/Schedule/Prizes/Apply Now) in the real muted color, a
            # decorative theme-toggle icon, and the real "Access portal"
            # teal button, all at the real nav's own font sizes.
            "custom_elements": [
                {"id": "seed.nav.bar", "kind": "box", "left": 0, "top": 0, "w": 1300, "h": 64},
                {"id": "seed.nav.logo", "kind": "image", "left": 24, "top": 10, "w": 44, "h": 44, "url": "assets/logo.png"},
                {"id": "seed.nav.brand", "kind": "text", "left": 77, "top": 19, "w": 150, "h": 30},
                {"id": "seed.nav.about", "kind": "text", "left": 243, "top": 20, "w": 60, "h": 26},
                {"id": "seed.nav.gallery", "kind": "text", "left": 328, "top": 20, "w": 65, "h": 26},
                {"id": "seed.nav.learn", "kind": "text", "left": 418, "top": 20, "w": 140, "h": 26},
                {"id": "seed.nav.schedule", "kind": "text", "left": 583, "top": 20, "w": 85, "h": 26},
                {"id": "seed.nav.prizes", "kind": "text", "left": 693, "top": 20, "w": 60, "h": 26},
                {"id": "seed.nav.apply", "kind": "text", "left": 778, "top": 20, "w": 95, "h": 26},
                {
                    "id": "seed.nav.theme", "kind": "icon", "left": 1080, "top": 20, "w": 24, "h": 24,
                    "icon": (
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
                        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" />'
                        '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>'
                    ),
                },
                {"id": "seed.nav.portal", "kind": "button", "left": 1136, "top": 7, "w": 140, "h": 50},
            ],
            "text": {
                "seed.nav.brand": "ECE Workshops",
                "seed.nav.about": "About",
                "seed.nav.gallery": "Gallery",
                "seed.nav.learn": "What you'll learn",
                "seed.nav.schedule": "Schedule",
                "seed.nav.prizes": "Prizes",
                "seed.nav.apply": "Apply Now",
                "seed.nav.portal": "Access portal",
            },
            # measured against the real classes: --font-head 700 1.05rem
            # "ECE Workshops" is 128.9x26.9 (.brand), .92rem nav links are
            # ~24px tall (.nav-links a, widest "What you'll learn" 116.7
            # wide), a real .btn-ghost "Access portal" is 135x49.5.
            "font_sizes": {"seed.nav.brand": "1.05rem"},
            "text_styles": {"seed.nav.brand": {"fontFamily": "var(--font-head)"}},
            "colors": {
                "seed.nav.about": "var(--muted)", "seed.nav.gallery": "var(--muted)",
                "seed.nav.learn": "var(--muted)", "seed.nav.schedule": "var(--muted)",
                "seed.nav.prizes": "var(--muted)", "seed.nav.apply": "var(--muted)",
                "seed.nav.theme": "var(--text)", "seed.nav.portal": "var(--teal)",
            },
            # the real .btn-accent2 "Access portal" button pairs its teal
            # background with dark navy text (#06121a), not the plain
            # button's default light text; text_color is the style
            # popover's separate Text color control for exactly this.
            "text_color": {"seed.nav.portal": "#06121a"},
            "groups": [[
                "seed.nav.bar", "seed.nav.logo", "seed.nav.brand", "seed.nav.about", "seed.nav.gallery",
                "seed.nav.learn", "seed.nav.schedule", "seed.nav.prizes", "seed.nav.apply",
                "seed.nav.theme", "seed.nav.portal",
            ]],
        },
    },
    {
        "name": "Heading + subheading",
        "data": {
            "custom_elements": [
                {"id": "seed.head.eyebrow", "kind": "text", "left": 0, "top": 0, "w": 110, "h": 26},
                {"id": "seed.head.title", "kind": "text", "left": 0, "top": 32, "w": 220, "h": 60},
            ],
            "text": {
                "seed.head.eyebrow": "Eyebrow",
                "seed.head.title": "Heading",
            },
            # 13px "EYEBROW" is 71x20.8, 34px --font-head "Heading" is
            # 129.2x54.4, same reasoning as the tile/countdown/navbar above.
            "font_sizes": {"seed.head.eyebrow": "13px", "seed.head.title": "34px"},
            "text_styles": {
                "seed.head.eyebrow": {"fontFamily": "var(--font-body)", "letterSpacing": "1px"},
                "seed.head.title": {"fontFamily": "var(--font-head)"},
            },
            "colors": {"seed.head.eyebrow": "var(--accent)"},
            "groups": [["seed.head.eyebrow", "seed.head.title"]],
        },
    },
]


def get_db():
    """opens a new connection to the sqlite database.
    @return a sqlite3.Connection with row_factory set to sqlite3.Row
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """creates the schema (if missing) and seeds accounts/content on first run."""
    DB_PATH.parent.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('student', 'ta')),
            plain TEXT
        )
        """
    )
    # plain holds student passwords so tas can read them back off the
    # accounts page (they're ta-issued handout credentials, not secrets).
    # ta rows stay null, those are hash-only. guarded alter for older dbs.
    try:
        conn.execute("ALTER TABLE users ADD COLUMN plain TEXT")
    except sqlite3.OperationalError:
        pass
    # login tokens, issued on login, checked on every ta-only request.
    # expires_at slides forward on every valid use (see get_session), so a
    # session only dies from real inactivity, not from navigating around.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            role TEXT NOT NULL,
            expires_at INTEGER
        )
        """
    )
    # guarded add for dbs created before expires_at existed. those old rows
    # come back with expires_at null, which get_session treats as expired,
    # a one-time forced re-login instead of the old "never expires" tokens.
    try:
        conn.execute("ALTER TABLE sessions ADD COLUMN expires_at INTEGER")
    except sqlite3.OperationalError:
        pass
    # single row of json holding everything the ta portal edits. simplest
    # thing that works for a handful of day panels and a short extras list.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT NOT NULL
        )
        """
    )
    # saved drafts of the whole content blob, per ta. shared=1 makes a
    # profile visible (and editable) to every ta, not just its owner.
    # is_default=1 marks the one seeded "Default" profile (see
    # _seed_default_profile()): shared with everyone, its data can never be
    # edited (api_update_profile in app/main.py 403s regardless of owner/
    # shared), but any ta can still delete it, unlike an ordinary profile
    # where only the owner can.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            shared INTEGER NOT NULL DEFAULT 0,
            is_default INTEGER NOT NULL DEFAULT 0,
            is_last_applied INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    # guarded add for dbs created before is_default existed.
    try:
        conn.execute("ALTER TABLE profiles ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    # guarded add for dbs created before is_last_applied existed (see
    # _seed_last_applied_profile()).
    try:
        conn.execute("ALTER TABLE profiles ADD COLUMN is_last_applied INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    # tiny flag table so _seed_default_profile() only ever inserts once,
    # ever: guarding it on "the profiles table happens to be empty" instead
    # would reseed a fresh "Default" the moment a ta deletes the only
    # profile that ever existed, on the server's very next restart, making
    # a delete that's supposed to stick silently undo itself.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """
    )
    # ta-uploaded icons/videos/fonts for the visual editor's Add element menu
    # and text toolbar font picker: visible to every ta right away (unlike a
    # profile, there's no separate "share" step), but only the ta who added
    # one can remove it again, see api_delete_asset() in app/main.py. the
    # site's own built-in icons/fonts aren't rows here at all, so they can
    # never be deleted through this table.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS custom_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL CHECK (kind IN ('icon', 'video', 'font')),
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL
        )
        """
    )
    # shared reusable-object library (see DEFAULT_OBJECTS above and
    # placeObject() in js/main.js): visible to every ta right away, same
    # "shared the moment it's added" model as custom_assets, but stores a
    # whole bundle (custom_elements + per-id override maps) as json instead
    # of a single uploaded file's url.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS objects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            data TEXT NOT NULL
        )
        """
    )
    conn.commit()
    _seed_users(conn)
    _backfill_plain(conn)
    _seed_content(conn)
    _seed_default_profile(conn)
    _seed_last_applied_profile(conn)
    _seed_default_objects(conn)
    _migrate_learn_reel(conn)
    conn.close()


def _seed_users(conn):
    """inserts SEED_STUDENTS/SEED_TAS if the users table is still empty.
    @param conn an open db connection
    """
    if conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        return
    rows = []
    for username, password in SEED_STUDENTS.items():
        password_hash, salt = hash_password(password)
        rows.append((username, password_hash, salt, "student", password))
    for username, password in SEED_TAS.items():
        password_hash, salt = hash_password(password)
        rows.append((username, password_hash, salt, "ta", None))
    conn.executemany(
        "INSERT INTO users (username, password_hash, salt, role, plain) VALUES (?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()


def _backfill_plain(conn):
    """fills in student plain-text passwords for dbs seeded before the plain
    column existed, by username, off the seed list.
    @param conn an open db connection
    """
    for username, password in SEED_STUDENTS.items():
        conn.execute(
            "UPDATE users SET plain = ? WHERE username = ? AND role = 'student' AND plain IS NULL",
            (password, username),
        )
    conn.commit()


def verify_login(username, password):
    """checks a login attempt against the stored hash.
    @param username the attempted username
    @param password the attempted plaintext password
    @return the user's role on success, none on a bad username or password
    """
    conn = get_db()
    row = conn.execute(
        "SELECT password_hash, salt, role FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    if not row or not verify_password(password, row["salt"], row["password_hash"]):
        return None
    return row["role"]


def create_session(username, role):
    """opens a new login session.
    @param username the logging-in user
    @param role "student" or "ta"
    @return the new session token
    """
    token = generate_token()
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (token, username, role, expires_at) VALUES (?, ?, ?, ?)",
        (token, username, role, int(time.time()) + _idle_seconds(role)),
    )
    conn.commit()
    conn.close()
    return token


def get_session(token):
    """looks up a session token, sliding its expiry forward on every valid
    call, so using the portal (or just having it open) keeps you logged in.
    @param token the bearer token to check
    @return the {username, role} row for the token, or none if it's missing or idle-expired
    """
    now = int(time.time())
    conn = get_db()
    row = conn.execute(
        "SELECT username, role, expires_at FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    if not row or not row["expires_at"] or row["expires_at"] < now:
        if row:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
        conn.close()
        return None
    conn.execute(
        "UPDATE sessions SET expires_at = ? WHERE token = ?",
        (now + _idle_seconds(row["role"]), token),
    )
    conn.commit()
    conn.close()
    return {"username": row["username"], "role": row["role"]}


def list_users():
    """lists every account. hashes never leave the db and ta passwords have
    no plain copy at all.
    @return a list of {username, role, password} rows (password is null for tas)
    """
    conn = get_db()
    rows = conn.execute("SELECT username, role, plain FROM users ORDER BY username").fetchall()
    conn.close()
    return [{"username": r["username"], "role": r["role"], "password": r["plain"]} for r in rows]


def create_user(username, password, role):
    """creates a new account.
    @param username the new account's username
    @param password the new account's plaintext password
    @param role "student" or "ta"
    @return false if the username is already taken
    """
    password_hash, salt = hash_password(password)
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, salt, role, plain) VALUES (?, ?, ?, ?, ?)",
            (username, password_hash, salt, role, password if role == "student" else None),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        # username taken (unique constraint)
        conn.close()
        return False
    conn.close()
    return True


def set_user_password(username, password):
    """changes an existing account's password (a ta's own, or anyone
    else's, both go through this same function, see api_change_password()).
    @param username the account to update
    @param password the new plaintext password
    @return false if no such user
    """
    conn = get_db()
    row = conn.execute("SELECT role FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        conn.close()
        return False
    password_hash, salt = hash_password(password)
    # students keep a plain copy (ta-issued handout credentials), tas don't, same rule create_user() uses
    plain = password if row["role"] == "student" else None
    conn.execute(
        "UPDATE users SET password_hash = ?, salt = ?, plain = ? WHERE username = ?",
        (password_hash, salt, plain, username),
    )
    conn.commit()
    conn.close()
    return True


def delete_user(username):
    """removes an account and any login tokens it had.
    @param username the account to remove
    @return false if no such user
    """
    conn = get_db()
    cur = conn.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.execute("DELETE FROM sessions WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def _seed_content(conn):
    """inserts DEFAULT_CONTENT if the content row doesn't exist yet.
    @param conn an open db connection
    """
    if conn.execute("SELECT 1 FROM content WHERE id = 1").fetchone():
        return
    conn.execute(
        "INSERT INTO content (id, data) VALUES (1, ?)", (json.dumps(DEFAULT_CONTENT),)
    )
    conn.commit()


def _seed_default_profile(conn):
    """inserts a shared, read-only "Default" profile holding DEFAULT_CONTENT
    (the site exactly as it looks out of the box), exactly once, ever,
    tracked by the meta table (not by "the profiles table is empty", which
    would reseed a fresh one the moment a ta deletes it if it was the only
    profile that ever existed, undoing a delete that's supposed to stick).
    Claims the meta flag with INSERT OR IGNORE first and checks rowcount,
    rather than a separate SELECT-then-INSERT: a dev server can restart
    twice in quick succession (eg two --reload events off one save), and a
    check-then-act gap would let both processes see "not seeded yet" and
    both insert, duplicating the profile. The meta table's key is a PRIMARY
    KEY, so only one INSERT OR IGNORE across any number of racing
    processes actually inserts a row; sqlite serializes the writes, so
    rowcount reliably tells this call whether it's the one that won.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('default_profile_seeded', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return
    conn.execute(
        "INSERT INTO profiles (owner, name, data, shared, is_default)"
        " VALUES (?, ?, ?, 1, 1)",
        ("system", "Default", json.dumps(DEFAULT_CONTENT)),
    )
    conn.commit()


def _seed_last_applied_profile(conn):
    """inserts a shared, permanent "Most recently applied" profile, exactly
    once, ever (same meta-flag trick as _seed_default_profile(), and for the
    same reason: this one is never supposed to come back once seeded,
    unlike a profile a ta made themselves). Its `data` isn't meant to stay
    at this seeded value: snapshot_last_applied() overwrites it every time
    anyone applies changes (see api_save_content() in app/main.py), always
    holding whatever was LIVE right before the most recent apply replaced
    it. That's the actual point of it: two tas editing at the same time can
    silently clobber each other (the last Apply always wins, there's no
    merge), and without this there'd be no way to get back what was live a
    moment before that happened. Unlike the Default profile, it can't be
    deleted by anyone at all (see api_delete_profile() in app/main.py), a
    ta deleting their own safety net would be a very easy way to lose it
    for good.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('last_applied_profile_seeded', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return
    conn.execute(
        "INSERT INTO profiles (owner, name, data, shared, is_last_applied)"
        " VALUES (?, ?, ?, 1, 1)",
        ("system", "Most recently applied", json.dumps(DEFAULT_CONTENT)),
    )
    conn.commit()


def _seed_default_objects(conn):
    """inserts the starter Objects library (DEFAULT_OBJECTS) exactly once,
    ever, same one-time meta-flag trick as _seed_default_profile(): a ta who
    deletes every seeded object shouldn't see them reappear on the server's
    next restart.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('default_objects_seeded', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return
    # "Countdown timer"'s datetime part carries no fixed target in
    # DEFAULT_OBJECTS itself (a hardcoded date would eventually sit in the
    # past); fill in 30 days out from right now, the same ballpark the ta
    # portal's own hero countdown starts from, at the moment this actually
    # seeds rather than at module-import time.
    default_target = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    for obj in DEFAULT_OBJECTS:
        data = obj["data"]
        if obj["name"] == "Countdown timer":
            data = json.loads(json.dumps(data))  # deep copy, don't mutate the shared module-level default
            for part in data["custom_elements"]:
                if part.get("kind") == "datetime":
                    part["target"] = default_target
        conn.execute(
            "INSERT INTO objects (owner, name, data) VALUES (?, ?, ?)",
            ("system", obj["name"], json.dumps(data)),
        )
    conn.commit()


def _migrate_learn_reel(conn):
    """one-time patch (same meta-flag trick as _seed_default_objects()) that
    adds the "What You'll Learn" reel (see _learn_reel_overlay()) to every
    already-existing content blob that predates it - the live content row
    AND every saved profile - so an old profile applied after this ships
    doesn't render a blank gap where the reel used to sit (its hardcoded
    markup is gone from templates/index.html now, replaced by the "reel"
    custom-element kind in js/main.js). A brand-new db never needs this:
    DEFAULT_CONTENT already carries the reel, so _seed_content() bakes it in
    directly.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('learn_reel_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        ids = [c.get("id") for c in data.get("custom_elements", [])]
        if "learn.reel" in ids:
            return data, False
        data.setdefault("custom_elements", []).append(json.loads(json.dumps(_LEARN_REEL_ENTRY)))
        data.setdefault("text", {}).update(_LEARN_REEL_TEXT)
        data.setdefault("font_sizes", {}).update(_LEARN_REEL_FONT_SIZES)
        data.setdefault("text_styles", {}).update(_LEARN_REEL_TEXT_STYLES)
        data.setdefault("colors", {}).update(_LEARN_REEL_COLORS)
        return data, True

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def get_content():
    """reads the live ta-editable content blob.
    @return the content dict, with any keys missing from an older save filled in from DEFAULT_CONTENT
    """
    conn = get_db()
    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    conn.close()
    if not row:
        return DEFAULT_CONTENT
    data = json.loads(row["data"])
    # blobs saved before a key existed (gallery, apply_tooltip, ...) come
    # back without it, fill those in from the defaults so the frontend
    # always sees the full shape
    for key, value in DEFAULT_CONTENT.items():
        data.setdefault(key, value)
    return data


def save_content(data):
    """overwrites the live content blob.
    @param data the full content dict to save
    """
    conn = get_db()
    conn.execute(
        "UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),)
    )
    conn.commit()
    conn.close()


def list_profiles(username):
    """lists a ta's saved content drafts.
    @param username the requesting ta
    @return that ta's own profiles plus anything another ta has shared
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT id, owner, name, data, shared, is_default, is_last_applied FROM profiles"
        " WHERE owner = ? OR shared = 1 ORDER BY id",
        (username,),
    ).fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "owner": r["owner"],
            "name": r["name"],
            "shared": bool(r["shared"]),
            "is_default": bool(r["is_default"]),
            "is_last_applied": bool(r["is_last_applied"]),
            "mine": r["owner"] == username,
            "data": json.loads(r["data"]),
        }
        for r in rows
    ]


def get_profile(profile_id):
    """looks up one profile.
    @param profile_id the profile's id
    @return the profile row, or none if it doesn't exist
    """
    conn = get_db()
    row = conn.execute(
        "SELECT id, owner, name, data, shared, is_default, is_last_applied FROM profiles WHERE id = ?",
        (profile_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "owner": row["owner"],
        "name": row["name"],
        "shared": bool(row["shared"]),
        "is_default": bool(row["is_default"]),
        "is_last_applied": bool(row["is_last_applied"]),
        "data": json.loads(row["data"]),
    }


def snapshot_last_applied(data):
    """overwrites the "Most recently applied" profile's data (see
    _seed_last_applied_profile()), called right before the live content
    gets replaced by a new Apply (see api_save_content() in app/main.py),
    so it always holds whatever was live a moment ago, not whatever just
    went live.
    @param data the outgoing (about to be replaced) live content dict
    """
    conn = get_db()
    conn.execute(
        "UPDATE profiles SET data = ? WHERE is_last_applied = 1",
        (json.dumps(data),),
    )
    conn.commit()
    conn.close()


def create_profile(owner, name, data):
    """saves a new profile.
    @param owner the ta creating it
    @param name the profile's display name
    @param data the content dict to save as this profile's draft
    @return the new profile's id
    """
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO profiles (owner, name, data) VALUES (?, ?, ?)",
        (owner, name, json.dumps(data)),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def update_profile(profile_id, name=None, data=None, shared=None):
    """partially updates a profile; omitted fields are left unchanged.
    @param profile_id the profile to update
    @param name new display name, if renaming
    @param data new content dict, if saving edits
    @param shared new shared flag, if toggling sharing
    """
    conn = get_db()
    if name is not None:
        conn.execute("UPDATE profiles SET name = ? WHERE id = ?", (name, profile_id))
    if data is not None:
        conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), profile_id))
    if shared is not None:
        conn.execute("UPDATE profiles SET shared = ? WHERE id = ?", (1 if shared else 0, profile_id))
    conn.commit()
    conn.close()


def delete_profile(profile_id):
    """deletes a profile.
    @param profile_id the profile to delete
    """
    conn = get_db()
    conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    conn.commit()
    conn.close()


def list_custom_assets(kind):
    """lists every ta-uploaded asset of one kind, shared with every ta.
    @param kind "icon", "video", or "font"
    @return a list of {id, owner, name, url} rows
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT id, owner, name, url FROM custom_assets WHERE kind = ? ORDER BY id",
        (kind,),
    ).fetchall()
    conn.close()
    return [{"id": r["id"], "owner": r["owner"], "name": r["name"], "url": r["url"]} for r in rows]


def create_custom_asset(kind, owner, name, url):
    """adds one ta-uploaded asset, visible to every ta immediately.
    @param kind "icon", "video", or "font"
    @param owner the uploading ta's username
    @param name display name
    @param url the already-uploaded file's url (see /api/upload)
    @return the new asset's id
    """
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO custom_assets (kind, owner, name, url) VALUES (?, ?, ?, ?)",
        (kind, owner, name, url),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def get_custom_asset(asset_id):
    """looks up one custom asset.
    @param asset_id the asset's id
    @return the asset row ({id, kind, owner, name, url}), or none if it doesn't exist
    """
    conn = get_db()
    row = conn.execute(
        "SELECT id, kind, owner, name, url FROM custom_assets WHERE id = ?", (asset_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row["id"], "kind": row["kind"], "owner": row["owner"], "name": row["name"], "url": row["url"]}


def delete_custom_asset(asset_id):
    """deletes a ta-uploaded asset.
    @param asset_id the asset to delete
    """
    conn = get_db()
    conn.execute("DELETE FROM custom_assets WHERE id = ?", (asset_id,))
    conn.commit()
    conn.close()


def list_objects():
    """lists every saved object in the shared reusable-objects library.
    @return a list of {id, owner, name, data} rows
    """
    conn = get_db()
    rows = conn.execute("SELECT id, owner, name, data FROM objects ORDER BY id").fetchall()
    conn.close()
    return [
        {"id": r["id"], "owner": r["owner"], "name": r["name"], "data": json.loads(r["data"])}
        for r in rows
    ]


def get_object(object_id):
    """looks up one saved object.
    @param object_id the object's id
    @return the object row, or none if it doesn't exist
    """
    conn = get_db()
    row = conn.execute(
        "SELECT id, owner, name, data FROM objects WHERE id = ?", (object_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row["id"], "owner": row["owner"], "name": row["name"], "data": json.loads(row["data"])}


def create_object(owner, name, data):
    """saves a new object to the shared library.
    @param owner the ta creating it
    @param name display name
    @param data the object's bundle (custom_elements + per-id override maps,
        same shape a chunk of content would use, see placeObject() in js/main.js)
    @return the new object's id
    """
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO objects (owner, name, data) VALUES (?, ?, ?)",
        (owner, name, json.dumps(data)),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def update_object(object_id, name=None, data=None):
    """partially updates an object; omitted fields are left unchanged. any ta
    can update an object's name/data, it's a shared team library, not
    per-owner content, only deleting is owner-restricted (see
    api_delete_object() in app/main.py, same rule a custom asset uses).
    @param object_id the object to update
    @param name new display name, if renaming
    @param data new bundle, if saving edits
    """
    conn = get_db()
    if name is not None:
        conn.execute("UPDATE objects SET name = ? WHERE id = ?", (name, object_id))
    if data is not None:
        conn.execute("UPDATE objects SET data = ? WHERE id = ?", (json.dumps(data), object_id))
    conn.commit()
    conn.close()


def delete_object(object_id):
    """deletes an object from the shared library.
    @param object_id the object to delete
    """
    conn = get_db()
    conn.execute("DELETE FROM objects WHERE id = ?", (object_id,))
    conn.commit()
    conn.close()
