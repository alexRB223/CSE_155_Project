from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Posture Backend", version="0.1.0")

DATA_DIR = Path(__file__).resolve().parent / "data"
STORE_PATH = DATA_DIR / "sessions.json"
DB_PATH = DATA_DIR / "app.db"


class BackendHealth(BaseModel):
    ok: bool
    service: str
    timestampIso: str


class SessionPreview(BaseModel):
    id: str
    durationSeconds: int = Field(gt=0)
    endedAtIso: str


class CreateSessionInput(BaseModel):
    durationSeconds: int = Field(gt=0)
    endedAtIso: str


class CreateUserInput(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class UserAccount(BaseModel):
    id: str
    username: str
    createdAt: str


class LoginUserInput(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


def _get_db_connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def _init_db() -> None:
    with _get_db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000
    ).hex()
    return f"{salt}:{password_hash}"


def _verify_password(password: str, stored_password_hash: str) -> bool:
    try:
        salt, expected_hash = stored_password_hash.split(":", maxsplit=1)
    except ValueError:
        return False

    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000
    ).hex()
    return secrets.compare_digest(password_hash, expected_hash)


def _map_user_row(row: sqlite3.Row) -> UserAccount:
    return UserAccount(
        id=row["id"],
        username=row["username"],
        createdAt=row["created_at"]
    )


def _create_user(payload: CreateUserInput) -> UserAccount:
    created_at = datetime.now(timezone.utc).isoformat()
    normalized_username = payload.username.strip()
    user = UserAccount(
        id=str(uuid.uuid4()),
        username=normalized_username,
        createdAt=created_at
    )

    try:
        with _get_db_connection() as connection:
            connection.execute(
                """
                INSERT INTO users (id, email, username, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    user.id,
                    f"{normalized_username.lower()}@local.user",
                    user.username,
                    _hash_password(payload.password),
                    user.createdAt
                )
            )
            connection.commit()
    except sqlite3.IntegrityError as error:
        message = str(error).lower()
        if "username" in message:
            raise HTTPException(status_code=409, detail="Username is already in use") from error
        raise HTTPException(status_code=400, detail="Unable to create user") from error

    return user


def _login_user(payload: LoginUserInput) -> UserAccount:
    with _get_db_connection() as connection:
        row = connection.execute(
            """
            SELECT id, email, username, password_hash, created_at
            FROM users
            WHERE username = ?
            """,
            (payload.username.strip(),)
        ).fetchone()

    if row is None or not _verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    return _map_user_row(row)


def _read_sessions() -> list[dict[str, Any]]:
    if not STORE_PATH.exists():
        return []

    try:
        data = json.loads(STORE_PATH.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except Exception:
        pass

    return []


def _write_sessions(sessions: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    STORE_PATH.write_text(json.dumps(sessions, indent=2), encoding="utf-8")


def _validate_iso8601(value: str) -> None:
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(status_code=400, detail="endedAtIso must be a valid ISO timestamp") from error


@app.on_event("startup")
def startup() -> None:
    _init_db()


@app.get("/health", response_model=BackendHealth)
def health() -> BackendHealth:
    return BackendHealth(
        ok=True,
        service="posture-backend",
        timestampIso=datetime.now(timezone.utc).isoformat()
    )


@app.get("/sessions", response_model=list[SessionPreview])
def list_sessions() -> list[SessionPreview]:
    sessions = _read_sessions()
    sessions.sort(key=lambda item: item.get("endedAtIso", ""), reverse=True)
    return [SessionPreview(**item) for item in sessions[:500]]


@app.post("/sessions/create", response_model=SessionPreview)
def create_session(payload: CreateSessionInput) -> SessionPreview:
    _validate_iso8601(payload.endedAtIso)

    session = SessionPreview(
        id=str(uuid.uuid4()),
        durationSeconds=payload.durationSeconds,
        endedAtIso=payload.endedAtIso
    )

    sessions = _read_sessions()
    sessions.insert(0, session.model_dump())
    _write_sessions(sessions[:500])

    return session


@app.post("/users/signup", response_model=UserAccount, status_code=201)
def signup(payload: CreateUserInput) -> UserAccount:
    return _create_user(payload)


@app.post("/users/login", response_model=UserAccount)
def login(payload: LoginUserInput) -> UserAccount:
    return _login_user(payload)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
