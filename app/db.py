"""sqlite connection + schema. users table holds hashed login credentials,
content table holds the TA-editable site content (day panels, extras, timer)."""

import json
import sqlite3
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
            role TEXT NOT NULL CHECK (role IN ('student', 'ta'))
        )
        """
    )
    # login tokens, issued on login, checked on every ta-only request.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            role TEXT NOT NULL
        )
        """
    )
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
    conn.commit()
    _seed_users(conn)
    _seed_content(conn)
    conn.close()


def _seed_users(conn):
    if conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        return
    rows = []
    for username, password in SEED_STUDENTS.items():
        password_hash, salt = hash_password(password)
        rows.append((username, password_hash, salt, "student"))
    for username, password in SEED_TAS.items():
        password_hash, salt = hash_password(password)
        rows.append((username, password_hash, salt, "ta"))
    conn.executemany(
        "INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?)",
        rows,
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
        "INSERT INTO sessions (token, username, role) VALUES (?, ?, ?)",
        (token, username, role),
    )
    conn.commit()
    conn.close()
    return token


def get_session(token):
    """returns the {username, role} row for a token, or none if it's not valid."""
    conn = get_db()
    row = conn.execute(
        "SELECT username, role FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


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
