# routers/applications.py — Week 8: Added Shortlist & Reject endpoints

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Form
from typing import Optional
from sqlalchemy.orm import Session, joinedload
from database import get_db
import models, schemas
import datetime
import json
import auth
import os

from ai_services import analyzer_service, utils, feedback_service

router = APIRouter(prefix="/applications", tags=["Applications"])

ALLOWED_STATUSES = {"Applied", "Reviewed", "Shortlisted", "Rejected", "Hired"}


# --- Apply to Job ---
@router.post("/apply", status_code=status.HTTP_201_CREATED)
def apply_to_job(
    background_tasks: BackgroundTasks,
    job_id: int = Form(...),
    candid: int = Form(...),
    cv_file: Optional[UploadFile] = File(None),
    github_link_override: Optional[str] = Form(None),
    linkedin_link_override: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    candidate = db.query(models.Candidates).filter(models.Candidates.candid == candid).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    job = db.query(models.JobPosting).filter(models.JobPosting.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Anti-fraud checks
    if not candidate.professional_summary or len(candidate.professional_summary) < 50:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Application Denied: Your profile summary is too short or empty. Fake profiles are prohibited."
        )

    if not candidate.skills or len(candidate.skills.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Application Denied: Please list your technical skills in your profile before applying."
        )

    if not cv_file and not candidate.resumelink:
        raise HTTPException(
            status_code=400,
            detail="Application Denied: No resume detected. Please upload a CV."
        )

    existing_application = db.query(models.Application).filter(
        models.Application.candid == candid,
        models.Application.job_id == job_id
    ).first()
    if existing_application:
        raise HTTPException(status_code=400, detail="You have already applied for this job")

    cv_path_for_application = ""
    if cv_file and cv_file.filename:
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        safe_filename = f"app_{candid}_{job_id}_{timestamp}_{cv_file.filename}"
        try:
            cv_path_for_application = utils.save_upload_file(cv_file, f"static/resumes/{safe_filename}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save uploaded CV: {str(e)}")
    else:
        cv_path_for_application = candidate.resumelink
        if not os.path.exists(cv_path_for_application):
            raise HTTPException(status_code=404, detail="Your master resume file is missing. Please re-upload.")

    try:
        new_application = models.Application(
            candid=candid,
            job_id=job_id,
            status="Applied",
            cv_path=cv_path_for_application,
        )

        pending_analysis = models.Analysis(
            candid=candid,
            job_id=job_id,
            analysis_status="Pending",
            remarks=json.dumps({"status_update": "Queueing for AI analysis..."}),
            application=new_application
        )

        db.add(new_application)
        db.add(pending_analysis)
        db.commit()
        db.refresh(new_application)

        background_tasks.add_task(
            analyzer_service.run_automatic_analysis,
            application_id=new_application.application_id,
            cv_path=cv_path_for_application
        )

        return {
            "message": "Application submitted successfully. Analysis is in progress.",
            "application_id": new_application.application_id
        }

    except Exception as e:
        db.rollback()
        print(f"Error during application save: {e}")
        raise HTTPException(status_code=500, detail="Database error occurred.")


@router.get("/candidate", response_model=list[schemas.ApplicationForCandidateRead])
def get_applications_for_current_candidate(
    db: Session = Depends(get_db),
    current_user: models.Candidates = Depends(auth.get_current_user)
):
    applications = db.query(models.Application).options(
        joinedload(models.Application.job)
    ).filter(
        models.Application.candid == current_user.candid
    ).order_by(
        models.Application.applied_on.desc()
    ).all()
    return applications


@router.get("/job/{job_id}", response_model=list[schemas.ApplicationRead])
def get_job_applicants(job_id: int, db: Session = Depends(get_db)):
    applications = (
        db.query(models.Application)
        .options(
            joinedload(models.Application.candidate),
            joinedload(models.Application.job)
        )
        .filter(models.Application.job_id == job_id)
        .all()
    )
    return applications


@router.put("/{application_id}/status", response_model=schemas.ApplicationRead)
def update_application_status(
    application_id: int,
    application_status: str,
    db: Session = Depends(get_db),
    current_hr: models.Hr = Depends(auth.get_current_hr)
):
    """
    Updates the status of a specific application.
    Allowed values: Applied, Reviewed, Shortlisted, Rejected, Hired
    """
    if application_status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {', '.join(ALLOWED_STATUSES)}"
        )

    application = db.query(models.Application).filter(
        models.Application.application_id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.status = application_status
    db.commit()
    db.refresh(application)
    return application


# ── WEEK 9: Shortlist endpoint with AUTO feedback ──────────────────────────────
@router.post("/{application_id}/shortlist", response_model=schemas.ApplicationRead)
def shortlist_application(
    application_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_hr: models.Hr = Depends(auth.get_current_hr)
):
    """
    Week 9: Shortlist an applicant — sets status to 'Shortlisted' and
    automatically sends AI-generated feedback to the candidate (no HR note needed).
    HR authentication required.
    """
    application = db.query(models.Application).options(
        joinedload(models.Application.candidate),
        joinedload(models.Application.job)
    ).filter(
        models.Application.application_id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if application.status == "Rejected":
        raise HTTPException(
            status_code=400,
            detail="Cannot shortlist a rejected application. Please review status first."
        )

    application.status = "Shortlisted"

    # ── Auto-feedback: fetch AI analysis report and send feedback automatically ──
    analysis_report = db.query(models.Analysis).filter(
        models.Analysis.application_id == application_id
    ).first()

    auto_feedback_content = None
    if analysis_report and analysis_report.feedback:
        # Use the already-generated AI feedback stored in the analysis
        auto_feedback_content = analysis_report.feedback
    elif analysis_report and application.job:
        # Generate fresh feedback from stored analysis data
        try:
            remarks_data = json.loads(analysis_report.remarks) if analysis_report.remarks else {}
            auto_feedback_content = feedback_service.generate_hr_feedback(
                analysis_data=remarks_data,
                db_report=analysis_report,
                job=application.job
            )
        except Exception as e:
            print(f"Warning: Could not generate auto-feedback for app {application_id}: {e}")

    if auto_feedback_content:
        # Save feedback record — attributed to the shortlisting HR
        auto_fb = models.Feedback(
            candid=application.candid,
            hr_id=current_hr.hr_id,
            reportid=analysis_report.reportid if analysis_report else None,
            content=auto_feedback_content,
            message_type="AI_Shortlist_Feedback"
        )
        db.add(auto_fb)

        # Fire-and-forget: simulate email dispatch in background
        candidate_email = application.candidate.email if application.candidate else None
        if candidate_email:
            background_tasks.add_task(
                feedback_service.send_feedback_email,
                email=candidate_email,
                feedback=auto_feedback_content
            )

    db.commit()
    db.refresh(application)
    return application


# ── WEEK 8: Reject endpoint ────────────────────────────────────────────────────
@router.post("/{application_id}/reject", response_model=schemas.ApplicationRead)
def reject_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_hr: models.Hr = Depends(auth.get_current_hr)
):
    """
    Week 8: Reject an applicant — sets status to 'Rejected'.
    HR authentication required.
    """
    application = db.query(models.Application).filter(
        models.Application.application_id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.status = "Rejected"
    db.commit()
    db.refresh(application)
    return application
