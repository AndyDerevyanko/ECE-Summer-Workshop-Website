"""sqlite connection + schema. users table holds hashed login credentials,
content table holds the TA-editable site content (day panels, extras, timer)."""

import json
import sqlite3
from pathlib import Path

from app.security import generate_token, hash_password, verify_password

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
    "date_mode": "tentative",
    "start_date": "",
    "end_date": "",
}

# seeded into the users table once, if it's empty. same accounts that used
# to live in the gitignored js/keys.js, kept the same for now per the coordinator.
SEED_STUDENTS = {
    "student01": "mkq4-vd72",
    "student02": "xh31-pw95",
    "student03": "qn85-rj20",
    "student04": "bt40-vs67",
    "student05": "fc17-zk93",
    "student06": "ky63-hg54",
    "student07": "gw28-td81",
    "student08": "dp54-cr36",
    "student09": "rb09-nm72",
    "student10": "mx71-sl48",
    "student11": "lq36-fh25",
    "student12": "hz82-jv60",
    "student13": "vk47-dt19",
    "student14": "tn93-yc84",
    "student15": "cw15-qb37",
    "student16": "bg60-ls52",
    "student17": "sf24-vp78",
    "student18": "pd78-gm41",
    "student19": "mr35-xk96",
    "student20": "kt81-aw03",
    "student21": "wj46-un59",
    "student22": "nc92-eq14",
    "student23": "qh57-oz88",
    "student24": "zl03-bf26",
    "student25": "vf68-rk50",
}
SEED_TAS = {
    "ta-1": "sfb520-mn84",
    "ta-2": "sfb520-wd61",
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
