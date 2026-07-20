"""password hashing. pbkdf2-sha256 with a random per-user salt, stdlib only."""

import hashlib
import hmac
import os
import secrets

ITERATIONS = 200_000


def generate_token():
    """generates an opaque session token.
    @return a random hex string
    """
    return secrets.token_hex(24)


def hash_password(password):
    """hashes a password with a fresh random salt.
    @param password the plaintext password
    @return (hash_hex, salt_hex)
    """
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return digest.hex(), salt.hex()


def verify_password(password, salt_hex, hash_hex):
    """checks a password against a stored hash/salt pair.
    @param password the plaintext password to check
    @param salt_hex the stored salt, hex-encoded
    @param hash_hex the stored hash, hex-encoded
    @return true if the password matches
    """
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return hmac.compare_digest(digest.hex(), hash_hex)
