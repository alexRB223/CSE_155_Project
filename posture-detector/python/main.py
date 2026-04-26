from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Posture Backend", version="0.1.0")

DATA_DIR = Path(__file__).resolve().parent / "data"
STORE_PATH = DATA_DIR / "sessions.json"


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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
