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
    return TA_IDLE_SECONDS if role == "ta" else STUDENT_IDLE_SECONDS

# starting content, same shape as the old hardcoded DAYS/EXTRAS/timer vars.
# only used the first time the content table is empty.
DEFAULT_CONTENT = {
    "days": [
        {"day": 1, "date": "", "opens_at": "", "unlocked": False, "title": "", "blurb": "", "files": []},
        {"day": 2, "date": "", "opens_at": "", "unlocked": False, "title": "", "blurb": "", "files": []},
    ],
    "extras": [],
    "timer_mode": "tentative",
    "timer_target": "",
    "contact_text": "Questions? hardware.robotics@utoronto.ca",
    "logistics": [
        {"big": "2 weeks", "lbl": "Tentative start date", "icon": False},
        {"big": "4 hours", "lbl": "1:30pm–5:30pm", "icon": False},
        {"big": "SFB520", "lbl": "Sandford Fleming", "icon": False},
        {"big": "", "lbl": "Certificate of completion", "icon": True},
    ],
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
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
    """dbs seeded before the plain column exist don't have student passwords
    stored, fill them back in from the seed list by username."""
    for username, password in SEED_STUDENTS.items():
        conn.execute(
            "UPDATE users SET plain = ? WHERE username = ? AND role = 'student' AND plain IS NULL",
            (password, username),
        )
    conn.commit()


def verify_login(username, password):
    """returns the user's role on success, none on a bad username or password."""
    conn = get_db()
    row = conn.execute(
        "SELECT password_hash, salt, role FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    if not row or not verify_password(password, row["salt"], row["password_hash"]):
        return None
    return row["role"]


def create_session(username, role):
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
    """returns the {username, role} row for a token, or none if it's missing
    or idle-expired. a valid token's expiry slides forward on every call,
    so using the portal (or just having it open) keeps you logged in."""
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
    """usernames, roles, and the stored student passwords. hashes never
    leave the db and ta passwords have no plain copy at all."""
    conn = get_db()
    rows = conn.execute("SELECT username, role, plain FROM users ORDER BY username").fetchall()
    conn.close()
    return [{"username": r["username"], "role": r["role"], "password": r["plain"]} for r in rows]


def create_user(username, password, role):
    """returns false if the username is already taken."""
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
    """removes the account and any login tokens it had. false if no such user."""
    conn = get_db()
    cur = conn.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.execute("DELETE FROM sessions WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def _seed_content(conn):
    if conn.execute("SELECT 1 FROM content WHERE id = 1").fetchone():
        return
    conn.execute(
        "INSERT INTO content (id, data) VALUES (1, ?)", (json.dumps(DEFAULT_CONTENT),)
    )
    conn.commit()


def get_content():
    conn = get_db()
    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    conn.close()
    return json.loads(row["data"]) if row else DEFAULT_CONTENT


def save_content(data):
    conn = get_db()
    conn.execute(
        "UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),)
    )
    conn.commit()
    conn.close()


def list_profiles(username):
    """your own profiles plus anything another ta has shared."""
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
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO profiles (owner, name, data) VALUES (?, ?, ?)",
        (owner, name, json.dumps(data)),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def update_profile(profile_id, name=None, data=None, shared=None):
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
    conn = get_db()
    conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    conn.commit()
    conn.close()
