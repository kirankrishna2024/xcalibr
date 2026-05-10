# XCalibr AI Hiring System — Week 7 (Complete)

> **Full-stack AI-powered hiring platform** — FastAPI backend · React + Vite frontend · PostgreSQL · Ollama (llama3)

This is the **merged Week 6 + Week 7** production-ready codebase. All Week 7 features have been integrated into the Week 6 base, including the full bug-fix backlog from both weeks.

---

## What's New in Week 7

| Feature | Description |
|---------|-------------|
| **ManageJobsPage** | Replaces PostJobPage — full CRUD (create / edit / delete / toggle) job manager with card grid, stats bar, filters |
| **Multi-job isolation fix** | Switching between jobs no longer bleeds score data from one job to another |
| **Resume inline PDF preview** | Clicking "CV" opens a PDF viewer modal; ESC to close |
| **Enhanced AI profile parsing** | Skill chips, experience timeline, certifications, JD Match breakdown |
| **Score color coding** | Green ≥70%, Amber 40–70%, Red <40% — consistent across all bars |
| **`PATCH /jobs/{id}/status`** | New backend endpoint to toggle Active ↔ Closed |
| **`applicant_count` on job cards** | Each ManageJobsPage card shows applicant badge |

---

## Prerequisites

You need all four of the following before starting:

### 1. Python 3.11+
```
https://www.python.org/downloads/
```

### 2. Node.js 18+ and npm
```
https://nodejs.org/
```

### 3. PostgreSQL 14+
- Install from: https://www.postgresql.org/download/
- Default credentials expected: **user** `postgres` / **password** `postgres123`
- Or update `backend/.env` with your own credentials

### 4. Ollama + llama3
```bash
# Install Ollama: https://ollama.com/download
# After install, run:
ollama serve

# In a new terminal:
ollama pull llama3  
ollama run llama3    # ~4 GB download, wait for completion
ollama list             # confirm llama3 is listed
```

> **Important:** Ollama must be running (`ollama serve`) every time you start the backend. Without it, AI analysis will fail with a clear error message rather than hanging silently.

---

## Database Setup

```bash
# Open psql as postgres superuser
psql -U postgres

# Create the database
CREATE DATABASE xcalibr_db;
\q

# Load the full schema + seed data
psql -U postgres -d xcalibr_db -f backend/Ai_Hiring_System\(database\).sql
```

**Windows users:**
```cmd
psql -U postgres -c "CREATE DATABASE xcalibr_db;"
psql -U postgres -d xcalibr_db -f "backend/Ai_Hiring_System(database).sql"
```

---

## Running the Backend

```bash
cd backend

# 1. Create virtual environment
python -m venv venv

# 2. Activate it
#    macOS / Linux:
source venv/bin/activate
#    Windows CMD:
venv\Scripts\activate.bat
#    Windows PowerShell:
venv\Scripts\Activate.ps1

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
cp .env.example .env
# Open .env and update DATABASE_URL if your PostgreSQL credentials differ

# 5. Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
uvicorn main:app --reload
```

✅ Backend running at: **http://127.0.0.1:8000**  
📖 Swagger API docs at: **http://127.0.0.1:8000/docs**

---

## Running the Frontend

Open a **second terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

✅ Frontend running at: **http://localhost:5173**

> If you get a Vite version error, run:
> ```bash
> npm uninstall vite
> npm install vite@7
> npm run dev
> ```

---

## Create an Admin Account

After the backend is running:

```bash
cd backend
# Activate venv if not already active
python create_admin.py
```

This creates the initial `admin` superuser. You can then log in at `/admin/login`.

---

## Create an HR Account

```bash
cd backend
python create_hr.py
```

Or use the Admin panel at `/system-admin-portal-2024` → User Management to create HR accounts.

---

## User Roles & Login URLs

| Role | Login URL | Default path after login |
|------|-----------|--------------------------|
| Candidate | `/candidate/login` | `/candidate/job-board` |
| HR / Recruiter | `/recruiter/login` | `/recruiter/dashboard` |
| Admin | `/admin/login` | `/system-admin-portal-2024` |

---

## Project Structure

```
xcalibr/
├── backend/
│   ├── ai_services/
│   │   ├── llm_clients/
│   │   │   └── ollama_client.py        ← Direct HTTP to Ollama, 3-min timeout
│   │   ├── analyzer_service.py         ← CV analysis, failsafe error handling
│   │   ├── feedback_service.py
│   │   ├── jd_matching_service.py
│   │   ├── prompts.py
│   │   └── utils.py
│   ├── routers/
│   │   ├── admin.py                    ← Admin CRUD, suspend/activate, password reset
│   │   ├── admin_dashboard.py          ← Admin KPIs
│   │   ├── analysis.py                 ← /health/ollama, /status/{id}, /retry, /rerun
│   │   ├── applications.py             ← Candidate apply, list applications
│   │   ├── candidates.py               ← Candidate auth, profile, resume upload
│   │   ├── hr.py                       ← HR auth, jobs (W7: applicant_count), dashboard
│   │   ├── hr_views.py                 ← Ranked applicants list (all statuses)
│   │   └── jobs.py                     ← CRUD + PATCH /status (Week 7)
│   ├── static/
│   │   └── resumes/                    ← Uploaded CV files stored here
│   ├── uploaded_linkedin_pdfs/         ← LinkedIn PDF uploads
│   ├── Ai_Hiring_System(database).sql  ← Full schema + seed data
│   ├── auth.py                         ← JWT helpers
│   ├── config.py
│   ├── create_admin.py                 ← Script to create admin user
│   ├── create_hr.py                    ← Script to create HR user
│   ├── database.py                     ← SQLAlchemy engine + session
│   ├── logging_utils.py
│   ├── main.py                         ← FastAPI app, CORS, router registration
│   ├── models.py                       ← SQLAlchemy ORM models
│   ├── requirements.txt
│   ├── schemas.py                      ← Pydantic schemas (W7: applicant_count added)
│   ├── security.py
│   ├── .env                            ← Your local config (not committed)
│   └── .env.example                    ← Template for .env
└── frontend/
    ├── public/
    │   ├── login-background.jpg
    │   ├── logo.png
    │   ├── logo1.jpg
    │   └── v1.mp4
    ├── src/
    │   ├── api/
    │   │   └── api.js                  ← All API calls (W7: updateJob, deleteJob, toggleJobStatus)
    │   ├── assets/
    │   ├── components/
    │   │   ├── AdminProtectedRoute.jsx
    │   │   ├── AnimatedBlobBackground.jsx
    │   │   ├── ApplicantModal.jsx      ← Score bars, error banner, status polling
    │   │   ├── ApplicantVolumeChart.jsx
    │   │   ├── Footer.jsx
    │   │   ├── Icons.jsx
    │   │   ├── JobCard.jsx
    │   │   ├── MetaBalls.jsx
    │   │   ├── Navbar.jsx
    │   │   ├── SendFeedbackModal.jsx
    │   │   ├── SharedUI.jsx
    │   │   ├── Sidebar.jsx             ← W7: "Manage Jobs" replaces "Post a Job"
    │   │   ├── UploadForm.jsx
    │   │   └── VideoModal.jsx
    │   ├── layouts/
    │   │   ├── AdminLayout.jsx
    │   │   └── DashboardLayout.jsx
    │   ├── pages/
    │   │   ├── AdminDashboard.jsx
    │   │   ├── AdminLogin.jsx
    │   │   ├── AdminUserManagement.jsx
    │   │   ├── Aboutpage.jsx
    │   │   ├── ApplicantsPage.jsx      ← W7: multi-job isolation, PDF preview, AI parsing
    │   │   ├── CandidateFeedbackPage.jsx
    │   │   ├── CandidateForgotPassword.jsx
    │   │   ├── CandidateLogin.jsx
    │   │   ├── CandidateSignup.jsx
    │   │   ├── CareersPage.jsx
    │   │   ├── Contactpage.jsx
    │   │   ├── HRFeedbackPage.jsx
    │   │   ├── JobBoard.jsx
    │   │   ├── LandingPage.jsx
    │   │   ├── ManageJobsPage.jsx      ← W7: NEW — full CRUD job manager
    │   │   ├── MyApplications.jsx
    │   │   ├── MyFeedback.jsx
    │   │   ├── PostJobPage.jsx         ← Kept for reference (route redirects to ManageJobsPage)
    │   │   ├── PricingPage.jsx
    │   │   ├── PrivacyPolicyPage.jsx
    │   │   ├── ProfilePage.jsx
    │   │   ├── RecruiterDashboard.jsx
    │   │   ├── RecruiterForgotPassword.jsx
    │   │   ├── RecruiterLogin.jsx
    │   │   ├── Settingspage.jsx
    │   │   ├── SystemLogPage.jsx
    │   │   └── TermsOfServicePage.jsx
    │   ├── utils/
    │   │   └── toast.jsx
    │   ├── App.jsx                     ← W7: /recruiter/manage-jobs route added
    │   ├── index.css
    │   └── main.jsx
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    └── vite.config.js
```

---

## API Endpoints Reference

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/candidates/` | Candidate registration |
| POST | `/candidates/login` | Candidate login |
| POST | `/hr/login` | HR login |
| POST | `/api/admin/login` | Admin login |
| GET | `/jobs/` | List all active jobs |

### HR (requires `hr_token`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hr/me` | Current HR profile |
| GET | `/hr/{hr_id}/jobs` | Jobs by HR (with applicant_count) |
| GET | `/hr/dashboard/kpis` | Dashboard stats |
| GET | `/hr/dashboard/job-summaries` | Job list with stats |
| GET | `/hr/dashboard/applicant-volume` | Chart data |
| GET | `/hr-views/jobs/{job_id}/rankings` | Ranked applicants for a job |
| POST | `/jobs/` | Create job |
| PUT | `/jobs/{job_id}` | Edit job |
| **PATCH** | **`/jobs/{job_id}/status`** | **Toggle Active ↔ Closed (Week 7)** |
| DELETE | `/jobs/{job_id}` | Delete job |
| GET | `/analysis/health/ollama` | Ollama health check |
| GET | `/analysis/status/{app_id}` | Analysis status + error reason |
| POST | `/analysis/retry/{app_id}` | Retry analysis |
| POST | `/analysis/rerun/{app_id}` | Rerun with new CV file |

### Admin (requires `admin_token`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/me` | Admin profile |
| GET/POST/DELETE | `/api/admin/hr/*` | Manage HR accounts |
| GET/POST/DELETE | `/api/admin/candidates/*` | Manage candidates |
| GET | `/api/admin/system-logs` | System audit logs |
| GET | `/admin-dashboard/kpis` | Platform-wide KPIs |

---

## How AI Analysis Works

1. Candidate submits application → record created with status `Pending`
2. Background task fires → status becomes `In Progress`
3. **Pre-flight check**: Is Ollama running? Is llama3 available?
   - **NO** → status → `Failed`, reason written to `remarks` column
4. **YES** → llama3 analyzes CV; scores computed for:
   - Career Readiness
   - JD Match (matched/missing skills breakdown)
   - GitHub Activity
   - LeetCode Performance
   - LinkedIn Profile
   - Trust Index
5. Status → `Completed`; scores visible in HR dashboard

**HR Workflow:**
- Open **Applicants** page → select a job
- Click **"Check AI Status"** to confirm Ollama is ready
- Click **"Analyze Pending"** to trigger analysis for all pending applicants
- Click **"View Details"** on any row to see full score breakdown
- Click the **"CV"** badge to view the resume inline

---

## Troubleshooting

### Backend won't start
```bash
pip install -r requirements.txt --upgrade
```
Check that your `.env` `DATABASE_URL` matches your PostgreSQL setup.

### "Ollama is not running"
```bash
ollama serve
```
Keep this terminal open while the backend is running.

### "Model llama3 is not available"
```bash
ollama pull llama3
```
This downloads ~4 GB. Wait until complete before starting the backend.

### Analysis stuck "In Progress"
- Restart the backend
- Click **"Analyze Pending"** from the Applicants page

### Frontend: blank screen or CORS errors
- Confirm backend is on port **8000**
- Confirm frontend is on port **5173**
- Check `.env` has correct `DATABASE_URL`
- Run `npm install` again if node_modules is missing

### Frontend: Vite version error
```bash
npm uninstall vite
npm install vite@7
npm run dev
```

### Database: fresh reset
```sql
-- In psql:
DROP DATABASE xcalibr_db;
CREATE DATABASE xcalibr_db;
\q
psql -U postgres -d xcalibr_db -f "backend/Ai_Hiring_System(database).sql"
```

---

## Quick Start Checklist

- [ ] PostgreSQL running, `xcalibr_db` created and SQL imported
- [ ] Ollama running (`ollama serve`) with llama3 pulled
- [ ] `backend/.env` configured
- [ ] Backend: `uvicorn main:app --reload` → http://127.0.0.1:8000/docs
- [ ] Frontend: `npm run dev` → http://localhost:5173
- [ ] Admin created: `python create_admin.py`
- [ ] HR created: `python create_hr.py` (or via Admin panel)

---

*XCalibr AI Hiring System — Built with FastAPI · React · PostgreSQL · Ollama (llama3)*
