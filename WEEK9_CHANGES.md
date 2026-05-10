# XCalibr AI Hiring System — Week 9 Changes

## What Changed This Week

### 🔔 Global Toast Notification System (`src/utils/toast.jsx`)
- **Full rewrite** of the toast utility
- Top-right animated notifications with slide-in/out
- Types: `success` (green), `error` (red), `warning` (amber), `info` (blue)
- Auto-dismiss with progress bar + manual close button
- Imperative API (`Toast.success(...)`) works anywhere without React context
- React hook API (`useToast()`) for components inside `<ToastProvider>`
- Replaced every `alert()` / `window.confirm()` platform-wide

---

### 🛡 Admin Portal

#### `AdminDashboard.jsx`
- New stat cards: HR Users / Candidates / Active Jobs / Pending Analyses
- Improved HR activity table with avatar initials & status badges
- Refresh button + last-refresh timestamp
- Toast error reporting (no alert())
- System health status badge

#### `AdminUserManagement.jsx` — Full Rewrite
- **ConfirmDialog modal** replaces `window.confirm()` for all delete/suspend actions
- **4 stat tiles** at top: Total HR, Total Candidates, Active Accounts, Suspended
- **UserAvatar** component: coloured initial circle from user's first letter
- **SkeletonRow** loading placeholders for all async table loads
- All buttons fully wired: Suspend/Activate/Delete/Reset Password
- Toast notifications for every action outcome
- Search filters both HR and Candidate tabs simultaneously

#### `SystemLogPage.jsx` — Full Rewrite
- Fixed broken `ShieldExclamationIcon` import (was undefined, crashed page)
- Removed `date-fns` dependency — uses native `Date.toLocaleString()`
- Search bar (free-text across admin name + description)
- Action type filter dropdown (ALL / CREATE / DELETE / UPDATE / LOGIN / LOGIN_FAIL)
- Pagination: 25 rows per page with Prev/Next controls
- Toast error reporting

---

### 👤 Candidate Portal

#### `ProfilePage.jsx` — Full Rewrite
- **ProfileCompletionBar**: visual % indicator with colour coding (green/amber/red)
- **SkillTag chips**: skills shown as removable tags, Enter/comma to add
- **Unsaved-changes indicator**: Save button highlights blue when dirty
- **Client-side validation**: required fields show inline red error messages
- **Resume "Open in New Window" FIXED**: uses authenticated blob-fetch so PDFs open in new tab even on protected endpoints
- Toast notifications for save/upload success and errors

#### `MyApplications.jsx` — Full Rewrite
- Summary stat bar: Total Applied / Shortlisted / Pending / Not Progressed
- Application cards with AI match score progress bars
- Search by job title + filter by status dropdown
- Loading skeleton cards
- Empty state with "Browse Jobs" CTA button

---

### 👔 Recruiter Portal

#### `RecruiterDashboard.jsx` — Full Rewrite
- Greeting header with time-of-day personalisation
- KPI grid: Active Jobs / Total Applicants / Pending Review / Shortlisted
- Job summaries table: clickable rows navigate to applicants for that job
- Quick-action buttons: Post New Job, Refresh
- Applicant volume chart in sidebar
- Loading skeleton states
- Toast error reporting

#### `ApplicantsPage.jsx` — Toast Integration
- All `alert()` calls replaced with `Toast.success/error/warning/info`
- Shortlist action: `Toast.success("Shortlisted ⭐")`
- Reject action: `Toast.success` + `Toast.info` hint about Feedback
- Retry analysis failure: `Toast.error`
- Batch analysis queue summary: separate success/error toasts
- All inline code sections commented

#### `ManageJobsPage.jsx` — Toast Integration
- Delete job failure → `Toast.error`
- Toggle job status failure → `Toast.error`

---

### ⚙ Backend / Setup

#### `setup_env.py` — New File
- **Code-based** dependency installer — no manual `pip install` commands needed
- Installs all packages programmatically: FastAPI, SQLAlchemy, LangChain, langchain-community, python-jose, etc.
- Auto-applies `--break-system-packages` flag for Ubuntu system Python
- Verifies all critical imports after installation
- Prints a pass/fail summary

#### `requirements.txt`
- Updated with clear section comments
- All LangChain packages pinned: `langchain==0.2.1`, `langchain-community==0.2.1`, `langchain-ollama==0.1.1`

---

## How to Run

### Backend
```bash
cd backend
python setup_env.py        # installs all dependencies (first time)
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Admin Portal
URL: `http://localhost:5173/admin/login`

### Candidate Portal
URL: `http://localhost:5173/candidate/login`

### Recruiter Portal
URL: `http://localhost:5173/recruiter/login`

---

### 🤖 Auto-Feedback on Shortlist (Week 9 — Backend)

#### `backend/routers/applications.py` — Shortlist endpoint upgraded
- **No HR note required**: When HR shortlists a candidate, AI-generated feedback is sent automatically.
- The system looks up the candidate's existing AI analysis report and uses its stored `feedback` field.
- If no pre-generated feedback exists, it calls `feedback_service.generate_hr_feedback()` live.
- A `Feedback` record is saved to the database with `message_type = "AI_Shortlist_Feedback"`.
- The candidate's email receives the feedback via `feedback_service.send_feedback_email()` (background task — non-blocking).
- **Important**: Email is fired-and-forgotten in a `BackgroundTask` so the shortlist API response returns instantly.

#### `backend/models.py` — Feedback model fix
- `hr_id` is now `nullable=True` to support system-initiated auto-feedback records.
  - Manual HR feedback still always sets `hr_id` to the HR's ID.
  - Auto-feedback from shortlisting also sets `hr_id` (the shortlisting HR is attributed).

#### `backend/requirements.txt` — Dependency fixes
- Pinned `pydantic==2.7.1` + `pydantic-core==2.18.4` together (fixes `validate_core_schema` ImportError).
- Pinned `pydantic-settings==2.3.0` (compatible with above).
- All other deps unchanged.

---

### 🛠 Setup Quick Reference (fix all ModuleNotFoundErrors at once)

```bash
# 1. Create & activate venv (Windows)
python -m venv venv
venv\Scripts\activate

# 2. Install all dependencies
pip install -r requirements.txt

# 3. Run server
python -m uvicorn main:app --reload
```

> Always use `python -m uvicorn` (not bare `uvicorn`) to ensure the venv interpreter is used.
