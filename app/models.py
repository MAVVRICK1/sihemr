from pydantic import BaseModel, Field
from typing import Optional
from uuid import uuid4
from datetime import datetime

def new_id():
    return str(uuid4())

def now_iso():
    return datetime.utcnow().isoformat()

class Patient(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    dob: Optional[str] = None
    gender: Optional[str] = None
    contact: Optional[str] = None

class Diagnosis(BaseModel):
    id: str = Field(default_factory=new_id)
    patient_id: str
    namaste_code: str
    icd11_code: str
    note: Optional[str] = None
    timestamp: str = Field(default_factory=now_iso)
