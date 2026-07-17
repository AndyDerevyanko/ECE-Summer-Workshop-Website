"""sqlite connection + schema. users table holds hashed login credentials."""

import sqlite3
from pathlib import Path

from app.security import hash_password, verify_password

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "app.db"

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
    conn.commit()
    _seed_users(conn)
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
