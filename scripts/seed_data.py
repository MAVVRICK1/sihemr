# scripts/seed_data.py
"""
Seed script for SIH-26 demo.
Creates data/users.json, data/patients.json, data/diagnoses.json,
data/codes.json, data/sessions.json for testing.

Usage:
  (from project root)
  python scripts/seed_data.py
"""

import json
import os
from passlib.context import CryptContext

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROOT = os.path.dirname(os.path.dirname(__file__)) if os.path.basename(os.getcwd()) == "scripts" else os.getcwd()
DATA_DIR = os.path.join(ROOT, "data")
STATIC_DATA_DIR = os.path.join(ROOT, "static", "data")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(STATIC_DATA_DIR, exist_ok=True)

USERS_FILE = os.path.join(DATA_DIR, "users.json")
PATIENTS_FILE = os.path.join(DATA_DIR, "patients.json")
DIAGNOSES_FILE = os.path.join(DATA_DIR, "diagnoses.json")
CODES_FILE = os.path.join(STATIC_DATA_DIR, "codes.json")  # frontend reads from static/data
SESSIONS_FILE = os.path.join(DATA_DIR, "sessions.json")

def write_json(path, obj):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
    print("WROTE", path)

def main():
    # Users to seed: clinician and patient (ravi)
    users = [
        {
            "username": "clinician1",
            "role": "clinician",
            "id": "C1",
            "password_hash": pwd.hash("clinic123")
        },
        {
            "username": "ravi",
            "role": "patient",
            "id": "101",
            "password_hash": pwd.hash("mav1234")
        }
    ]
    write_json(USERS_FILE, users)

    # Patients: seed ravi as patient id 101
    patients = [
        {
            "id": 101,
            "name": "Ravi Kumar",
            "dob": "1988-07-12",
            "gender": "male",
            "contact": "9999999999"
        }
    ]
    write_json(PATIENTS_FILE, patients)

    # Diagnoses: a sample diagnosis for ravi
    diagnoses = [
        {
            "id": 1001,
            "patient_id": 101,
            "namaste_code": "NAM-001",
            "icd11_code": "CA22",
            "note": "Initial consult: fever and cough"
        }
    ]
    write_json(DIAGNOSES_FILE, diagnoses)

    # Codes: sample expanded codes (short list, you can replace with your full list)
    codes_blob = {
      "namaste": [
        { "code": "NAM-001", "display": "Fever" },
        { "code": "NAM-002", "display": "Headache" },
        { "code": "NAM-003", "display": "Cough" },
        { "code": "NAM-004", "display": "Tuberculosis" },
        { "code": "NAM-005", "display": "Hypertension" },
        { "code": "NAM-006", "display": "Diabetes mellitus" },
        { "code": "NAM-007", "display": "Chronic obstructive pulmonary disease" },
        { "code": "NAM-008", "display": "Asthma" },
        { "code": "NAM-009", "display": "Ischaemic heart disease" },
        { "code": "NAM-010", "display": "Stroke" }
      ],
      "icd11": [
        { "code": "1A04", "display": "Typhoid fever" },
        { "code": "1E40", "display": "Dengue" },
        { "code": "1F40", "display": "Malaria" },
        { "code": "CA40", "display": "Pneumonia, unspecified" },
        { "code": "CA22", "display": "Acute upper respiratory infection" },
        { "code": "CA23", "display": "Asthma" },
        { "code": "CA25", "display": "Chronic obstructive pulmonary disease" },
        { "code": "5A11", "display": "Hypertension" },
        { "code": "5A13", "display": "Diabetes mellitus, type 2" },
        { "code": "BA40", "display": "Ischaemic heart disease" }
      ]
    }
    write_json(CODES_FILE, codes_blob)

    # Ensure sessions file exists and is empty
    write_json(SESSIONS_FILE, {})

    print("\nSEED COMPLETE.")
    print("Seeded users: clinician1 / clinic123   and   ravi / mav1234")
    print("Patient id for ravi:", 101)
    print("You can now start the server and test login + /api/myrecords")

if __name__ == "__main__":
    main()

