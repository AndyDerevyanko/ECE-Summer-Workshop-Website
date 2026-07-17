"""password hashing. pbkdf2-sha256 with a random per-user salt, stdlib only."""

import hashlib
import hmac
import os
import secrets

ITERATIONS = 200_000


def generate_token():
    return secrets.token_hex(24)


def hash_password(password):
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return digest.hex(), salt.hex()


def verify_password(password, salt_hex, hash_hex):
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return hmac.compare_digest(digest.hex(), hash_hex)
