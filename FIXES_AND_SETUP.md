# XCalibr — Fixes Applied & Setup Guide

## ✅ Bugs Fixed

### 1. WHITE SCREEN AFTER LOGIN (Critical Fix)
**File:** `frontend/src/layouts/DashboardLayout.jsx`

**Root Cause:** React's Rules of Hooks were violated — two `useEffect` hooks were
placed *after* an early `return` statement (`if (loading) return ...`). React
requires ALL hooks to be called in the same order on every render, before any
conditional returns. This caused a runtime error that rendered a blank white screen.

**Fix:** Moved all three `useEffect` hooks to the top of the component, before
the early `if (loading)` return. Added a second null-guard `if (!userData)` return
as well, for the case where navigation is still in progress.

---

### 2. .env KEY MISMATCH (Backend won't start)
**File:** `backend/.env`

**Root Cause:** `config.py` uses `database_url` (lowercase) in its `BaseSettings`
class, but the `.env` file had `DATABASE_URL` (uppercase). Pydantic Settings is
case-sensitive in some environments, causing the backend to fail to find the DB URL.

**Fix:** Changed `.env` and `.env.example` to use lowercase `database_url`.

---

### 3. requirements.txt DUPLICATES & CONFLICTS (pip install errors)
**File:** `backend/requirements.txt`

**Root Cause:** The file had duplicate entries (`fastapi`, `uvicorn`, `psycopg2-binary`,
`pydantic`, `email-validator` all listed 2–3 times), a missing `pydantic-settings`
package (needed by `config.py`), and conflicting version pins.

**Fix:** Rewrote `requirements.txt` with clean, non-duplicate pinned versions.
Added `pydantic-settings==2.2.1` which `config.py` requires.

---

### 4. WEEK 8 — Shortlist & Reject New Feature (New Feature)

#### Backend
**File:** `backend/routers/applications.py`

Added two new dedicated endpoints:
- `POST /applications/{id}/shortlist` — Sets status to `"Shortlisted"`, HR auth required
- `POST /applications/{id}/reject` — Sets status to `"Rejected"`, HR auth required
- Also secured the existing `PUT /applications/{id}/status` with HR authentication
- Validates allowed statuses: `Applied`, `Reviewed`, `Shortlisted`, `Rejected`, `Hired`

#### Frontend API
**File:** `frontend/src/api/api.js`

Added:
```js
export const shortlistApplication = (appId) => HrAPI.post(`/applications/${appId}/shortlist`).then(r => r.data);
export const rejectApplication    = (appId) => HrAPI.post(`/applications/${appId}/reject`).then(r => r.data);
```

#### Frontend Page
**File:** `frontend/src/pages/ApplicantsPage.jsx`

Updated `handleStatusChange()` to route through the dedicated Week 8 endpoints
instead of always calling the generic `updateApplicationStatus`. The Shortlist
and Reject buttons already existed in the UI — they are now backed by real
dedicated API calls.

---

## 🚀 How to Run

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL running with a database named `xcalibr_db`
- (Optional) Ollama running locally for AI analysis

### Step 1 — Set up the database
```sql
CREATE DATABASE xcalibr_db;
```
Then import the schema:
```bash
psql -U postgres xcalibr_db < backend/Ai_Hiring_System\(database\).sql
```

### Step 2 — Configure environment
```bash
cd backend
cp .env.example .env
# Edit .env and set your database password and a strong SECRET_KEY
```

### Step 3 — Start the backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Or use the helper script: `bash start_backend.sh`

Backend will be available at: http://127.0.0.1:8000
API docs (Swagger): http://127.0.0.1:8000/docs

### Step 4 — Start the frontend
```bash
cd frontend
npm install
npm run dev
```
Or use the helper script: `bash start_frontend.sh`

Frontend will be available at: http://localhost:5173

### Step 5 — Create initial admin user
```bash
cd backend
python create_admin.py
```

---

## 📋 Week Summary

| Week | Feature |
|------|---------|
| Week 7 | Multi-job management (ManageJobsPage), Job CRUD, toggle Active/Closed |
| **Week 8** | **Shortlist & Reject dedicated endpoints + HR auth protection** |

