# main.py — Fixed: StaticFiles mounted so /static/resumes/* serves correctly

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import models
from database import engine
from routers import candidates, jobs, applications, analysis, hr_views, hr, admin, admin_dashboard

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="XCalibr AI Hiring System")

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount static file directories so PDFs/resumes are served correctly ─────────
# Files saved to "static/resumes/" by candidates.py will be accessible at:
#   http://127.0.0.1:8000/static/resumes/<filename>
os.makedirs("static/resumes", exist_ok=True)
os.makedirs("uploaded_linkedin_pdfs", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploaded_linkedin_pdfs", StaticFiles(directory="uploaded_linkedin_pdfs"), name="linkedin_pdfs")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(candidates.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(analysis.router)
app.include_router(hr_views.router)
app.include_router(hr.router)
app.include_router(admin_dashboard.router)


@app.get("/")
def root():
    return {"message": "Backend is running"}
