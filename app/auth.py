"""
app/auth.py
Simple token-based auth dependency for FastAPI.
Uses app.storage sessions for token -> user resolution.

Login issues:
- /api/login should create a token (UUID) and save session via storage.create_session(token, user)
- get_current_user reads Authorization: Bearer <token> and returns the user dict stored in session
"""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict
from app import storage

security = HTTPBearer(auto_error=False)


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict:
    """
    Dependency that returns the logged-in user dict or raises HTTPException if invalid.
    """
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = credentials.credentials
    sess = storage.get_session(token)
    if not sess:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = sess.get("user")
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return user


def require_role(role: str):
    def _require(u: Dict = Depends(get_current_user)):
        if u.get("role") != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient privileges")
        return u
    return _require

