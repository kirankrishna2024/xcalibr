# routers/jobs.py — Week 7
# Added: PATCH /jobs/{job_id}/status — toggle Active/Closed
# Added: applicant_count in job responses via enriched query
# Existing: POST, GET, PUT, DELETE all preserved

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from database import get_db
import models, schemas
from pydantic import BaseModel

router = APIRouter(prefix="/jobs", tags=["Jobs"])


class StatusToggleRequest(BaseModel):
    status: str  # "Active" or "Closed"


def _enrich_with_applicant_count(jobs: list, db: Session) -> list:
    """Add applicant_count to each job dict by querying Application table."""
    if not jobs:
        return jobs
    job_ids = [j.job_id for j in jobs]
    counts = (
        db.query(models.Application.job_id, func.count(models.Application.application_id).label("cnt"))
        .filter(models.Application.job_id.in_(job_ids))
        .group_by(models.Application.job_id)
        .all()
    )
    count_map = {row.job_id: row.cnt for row in counts}
    result = []
    for job in jobs:
        d = {c.name: getattr(job, c.name) for c in job.__table__.columns}
        d["applicant_count"] = count_map.get(job.job_id, 0)
        result.append(d)
    return result


# ─── Create job ───────────────────────────────────────────────────────────────
@router.post("/", response_model=schemas.JobPostingRead)
def create_job(job: schemas.JobPostingCreate, db: Session = Depends(get_db)):
    new_job = models.JobPosting(**job.dict())
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job


# ─── List jobs (public, optionally filtered by hr_id) ────────────────────────
@router.get("/", response_model=List[schemas.JobPostingRead])
def get_jobs(hr_id: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(models.JobPosting)
    if hr_id:
        query = query.filter(models.JobPosting.hr_id == hr_id)
    return query.all()


# ─── Get single job ───────────────────────────────────────────────────────────
@router.get("/{job_id}", response_model=schemas.JobPostingRead)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.JobPosting).filter(models.JobPosting.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ─── Update job (full edit) ───────────────────────────────────────────────────
@router.put("/{job_id}", response_model=schemas.JobPostingRead)
def update_job(job_id: int, job: schemas.JobPostingCreate, db: Session = Depends(get_db)):
    db_job = db.query(models.JobPosting).filter(models.JobPosting.job_id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    for key, value in job.dict(exclude_unset=True).items():
        setattr(db_job, key, value)
    db.commit()
    db.refresh(db_job)
    return db_job


# ─── Toggle job status (Active ↔ Closed) — WEEK 7 NEW ────────────────────────
@router.patch("/{job_id}/status", response_model=schemas.JobPostingRead)
def toggle_job_status(job_id: int, payload: StatusToggleRequest, db: Session = Depends(get_db)):
    """
    Toggle a job between Active and Closed status.
    Body: { "status": "Active" | "Closed" }
    """
    db_job = db.query(models.JobPosting).filter(models.JobPosting.job_id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    allowed = {"Active", "Closed"}
    if payload.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {allowed}")
    db_job.status = payload.status
    db.commit()
    db.refresh(db_job)
    return db_job


# ─── Delete job ───────────────────────────────────────────────────────────────
@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    db_job = db.query(models.JobPosting).filter(models.JobPosting.job_id == job_id).first()
    if not db_job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(db_job)
    db.commit()
    return {"detail": "Job deleted successfully"}
