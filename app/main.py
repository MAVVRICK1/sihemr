"""
app/main.py
Main FastAPI app. Uses app.storage for persistence and app.auth for authentication.
"""

import os
import uuid
from fastapi import FastAPI, Form, Depends, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any
from passlib.context import CryptContext

from app import storage
from app.auth import get_current_user, require_role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="SIH-26 Demo API")

# Allow local dev frontend to call API (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- static root endpoint ----------
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
STATIC_DIR = os.path.join(PROJECT_ROOT, "static")


@app.get("/")
async def root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"detail": "Index not found"}


# ---------- auth: login ----------
@app.post("/api/login")
async def login(username: str = Form(...), password: str = Form(...)):
    user = storage.find_user_by_username(username)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    stored_hash = user.get("password_hash")
    if not stored_hash or not pwd_context.verify(password, stored_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    # create token
    token = uuid.uuid4().hex
    # Persist session
    storage.create_session(token, user)
    return {"access_token": token, "token_type": "bearer", "username": user.get("username"), "role": user.get("role"), "id": user.get("id")}


# ---------- users: (for completeness) ----------
@app.get("/api/users")
async def get_users(current_user: Dict = Depends(require_role("clinician"))):
    # only clinicians can list users
    return storage.load_users()


# ---------- patients ----------
@app.post("/api/patients")
async def create_patient(payload: Dict, current_user: Dict = Depends(require_role("clinician"))):
    """
    Create a new patient. Clinician-only.
    Payload is expected JSON: {name, dob, gender, contact, ...}
    """
    saved = storage.create_patient(payload)
    return saved


# ---------- diagnoses ----------
@app.post("/api/diagnoses")
async def create_diagnosis(payload: Dict, current_user: Dict = Depends(require_role("clinician"))):
    """
    Create a diagnosis record. Clinician-only.
    Expected payload: {patient_id, namaste_code, icd11_code, note}
    """
    # basic validation
    if not payload.get("patient_id"):
        raise HTTPException(status_code=400, detail="patient_id required")
    saved = storage.create_diagnosis(payload)
    return saved


# ---------- records (clinician view: all records) ----------
@app.get("/api/records")
async def get_records(current_user: Dict = Depends(get_current_user)):
    """
    Clinicians get full records; patients are restricted from this endpoint.
    """
    if current_user.get("role") != "clinician":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clinicians only")
    return storage.load_all_records_combined()


# ---------- myrecords (patient view) ----------
@app.get("/api/myrecords")
async def my_records(current_user: Dict = Depends(get_current_user)):
    """
    Returns only records for the authenticated patient.
    Patients only.
    """
    if current_user.get("role") != "patient":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Patients only")
    # determine patient id (accept numeric id or username)
    pid = current_user.get("id") or current_user.get("user_id") or current_user.get("username")
    if pid is None:
        return []
    pid_str = str(pid)
    # gather diagnoses and patients that match this patient id
    out = []
    # patients
    for p in storage.load_patients():
        if str(p.get("id")) == pid_str or str(p.get("username", "")) == pid_str:
            obj = dict(p); obj["type"] = "patient"; out.append(obj)
    # diagnoses
    for d in storage.load_diagnoses():
        if str(d.get("patient_id")) == pid_str:
            obj = dict(d); obj["type"] = "diagnosis"; out.append(obj)
    return out


# ---------- single fhir bundle endpoint ----------
@app.get("/api/records/{record_id}/fhir")
async def get_fhir_bundle(record_id: str, current_user: Dict = Depends(get_current_user)):
    """
    Returns a simple FHIR-like bundle for the requested diagnosis record.
    Access rules:
     - clinicians may fetch any diagnosis bundle
     - patients may fetch only their own diagnosis bundle (if it belongs to them)
    """
    rec = storage.get_diagnosis(record_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    # permission check
    if current_user.get("role") == "patient":
        pid = current_user.get("id") or current_user.get("user_id") or current_user.get("username")
        if str(rec.get("patient_id")) != str(pid):
            raise HTTPException(status_code=403, detail="Forbidden")
    # build a minimal FHIR bundle (demo)
    bundle = {
        "resourceType": "Bundle",
        "type": "document",
        "entry": [
            {
                "resource": {
                    "resourceType": "Condition",
                    "id": str(rec.get("id")),
                    "subject": {"reference": f"Patient/{rec.get('patient_id')}"},
                    "code": {
                        "coding": [
                            {"system": "NAMASTE", "code": rec.get("namaste_code")},
                            {"system": "ICD-11", "code": rec.get("icd11_code")}
                        ],
                        "text": rec.get("note") or ""
                    },
                    "note": [{"text": rec.get("note") or ""}]
                }
            }
        ]
    }
    return JSONResponse(bundle)


# ---------- codes endpoint ----------
@app.get("/api/codes")
async def codes():
    """
    Return the entire codes blob (namaste + icd11).
    For production you might want a search endpoint; for the demo frontend this is acceptable.
    """
    return storage.load_codes()


# ---------- static files mount (serve everything under /static) ----------
from fastapi.staticfiles import StaticFiles
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

