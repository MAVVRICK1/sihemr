from typing import Dict

def patient_to_fhir(patient: Dict):
    p = {
        "resourceType": "Patient",
        "id": patient.get("id"),
        "name": [{"text": patient.get("name")}],
        "gender": patient.get("gender"),
        "birthDate": patient.get("dob"),
        "telecom": [{"system": "phone", "value": patient.get("contact")}]
    }
    return p

def diagnosis_to_condition(diag: Dict):
    c = {
        "resourceType": "Condition",
        "id": diag.get("id"),
        "subject": {"reference": f"Patient/{diag.get('patient_id')}"},
        "code": {
            "coding": [
                {"system": "urn:namaste", "code": diag.get("namaste_code")},
                {"system": "http://id.who.int/icd/release/11", "code": diag.get("icd11_code")}
            ],
            "text": diag.get("note")
        },
        "recordedDate": diag.get("timestamp")
    }
    return c

def record_to_fhir(record: Dict):
    bundle = {"resourceType": "Bundle", "type": "collection", "entry": []}
    if not record:
        return bundle
    kind = record.get("id", "")
    if record.get("name"):
        bundle["entry"].append({"resource": patient_to_fhir(record)})
    else:
        bundle["entry"].append({"resource": diagnosis_to_condition(record)})
    return bundle
