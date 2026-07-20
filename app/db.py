"""sqlite connection + schema. users table holds hashed login credentials,
content table holds the TA-editable site content (day panels, extras, timer)."""

import json
import sqlite3
import time
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
    "contact_text": "Questions? hardware.robotics@utoronto.ca",
    "join_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "apply_tooltip": "Applications open once the workshop dates are confirmed, check back soon.",
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
}


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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            shared INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    conn.commit()
    _seed_users(conn)
    _backfill_plain(conn)
    _seed_content(conn)
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
        "SELECT id, owner, name, data, shared FROM profiles"
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
        "SELECT id, owner, name, data, shared FROM profiles WHERE id = ?",
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
        "data": json.loads(row["data"]),
    }


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
