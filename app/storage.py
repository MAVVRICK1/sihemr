"""
app/storage.py
JSON-backed storage helpers for users, patients, diagnoses, codes, sessions.
Simple, file-based. Safe for local dev / demos. Not intended as a production DB.
"""

import json
import os
import threading
from typing import Any, Dict, List, Optional

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

_USERS = os.path.join(DATA_DIR, "users.json")
_PATIENTS = os.path.join(DATA_DIR, "patients.json")
_DIAGNOSES = os.path.join(DATA_DIR, "diagnoses.json")
_CODES = os.path.join(DATA_DIR, "codes.json")
_SESSIONS = os.path.join(DATA_DIR, "sessions.json")

_lock = threading.Lock()


def _read_json(path: str, default: Any):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return default


def _write_json(path: str, data: Any):
    with _lock:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, indent=2)


# ---------- users ----------
def load_users() -> List[Dict]:
    return _read_json(_USERS, [])


def save_users(users: List[Dict]):
    _write_json(_USERS, users)


def find_user_by_username(username: str) -> Optional[Dict]:
    users = load_users()
    for u in users:
        if u.get("username") == username:
            return u
    return None


def upsert_user(user: Dict):
    users = load_users()
    for i, u in enumerate(users):
        if u.get("username") == user.get("username"):
            users[i] = user
            save_users(users)
            return
    users.append(user)
    save_users(users)


# ---------- patients ----------
def load_patients() -> List[Dict]:
    return _read_json(_PATIENTS, [])


def save_patients(patients: List[Dict]):
    _write_json(_PATIENTS, patients)


def create_patient(payload: Dict) -> Dict:
    patients = load_patients()
    # assign simple incremental id
    next_id = 1
    if patients:
        try:
            next_id = int(max(p.get("id", 0) for p in patients)) + 1
        except Exception:
            next_id = len(patients) + 1
    payload = dict(payload)
    payload["id"] = payload.get("id") or next_id
    patients.append(payload)
    save_patients(patients)
    return payload


def get_patient(patient_id) -> Optional[Dict]:
    patients = load_patients()
    for p in patients:
        if str(p.get("id")) == str(patient_id):
            return p
    return None


# ---------- diagnoses ----------
def load_diagnoses() -> List[Dict]:
    return _read_json(_DIAGNOSES, [])


def save_diagnoses(diags: List[Dict]):
    _write_json(_DIAGNOSES, diags)


def create_diagnosis(payload: Dict) -> Dict:
    diags = load_diagnoses()
    next_id = 1
    if diags:
        try:
            next_id = int(max(d.get("id", 0) for d in diags)) + 1
        except Exception:
            next_id = len(diags) + 1
    payload = dict(payload)
    payload["id"] = payload.get("id") or next_id
    diags.append(payload)
    save_diagnoses(diags)
    return payload


def get_diagnosis(diagnosis_id) -> Optional[Dict]:
    diags = load_diagnoses()
    for d in diags:
        if str(d.get("id")) == str(diagnosis_id):
            return d
    return None


# ---------- combined records view ----------
def load_all_records_combined() -> List[Dict]:
    """
    Return a combined list of patient entries (with 'type': 'patient') and diagnosis entries
    (with 'type': 'diagnosis') for convenience in the frontend.
    """
    out = []
    for p in load_patients():
        c = dict(p)
        c["type"] = "patient"
        out.append(c)
    for d in load_diagnoses():
        c = dict(d)
        c["type"] = "diagnosis"
        out.append(c)
    # optional: sort by id or time if available; keep insertion order by default
    return out


# ---------- codes ----------
def load_codes() -> Dict[str, List[Dict]]:
    """
    Prefer static/data/codes.json if present (some projects store codes in static/), else data/codes.json.
    """
    # first look for a static copy under project root
    static_path = os.path.join(BASE_DIR, "static", "data", "codes.json")
    if os.path.exists(static_path):
        return _read_json(static_path, {"namaste": [], "icd11": []})
    return _read_json(_CODES, {"namaste": [], "icd11": []})


def save_codes(blob: Dict):
    _write_json(_CODES, blob)


# ---------- sessions (simple token store) ----------
def _load_sessions() -> Dict[str, Dict]:
    return _read_json(_SESSIONS, {})


def _save_sessions(sessions: Dict[str, Dict]):
    _write_json(_SESSIONS, sessions)


def create_session(token: str, user: Dict):
    sessions = _load_sessions()
    sessions[token] = {"user": user}
    _save_sessions(sessions)


def get_session(token: str) -> Optional[Dict]:
    sessions = _load_sessions()
    return sessions.get(token)


def delete_session(token: str):
    sessions = _load_sessions()
    if token in sessions:
        del sessions[token]
        _save_sessions(sessions)
