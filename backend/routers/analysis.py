# routers/analysis.py — Enhanced: status endpoint returns partial scores for real-time display

import os
import json
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, BackgroundTasks, status
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
from database import get_db
from ai_services import analyzer_service, jd_matching_service, utils
from ai_services.llm_clients import ollama_client

router = APIRouter(prefix="/analysis", tags=["Analysis"])

UPLOAD_DIRECTORY = "static/resumes"


# ============================================================
# Ollama Health Check
# ============================================================

@router.get("/health/ollama", response_model=schemas.OllamaHealthResponse)
def check_ollama_health():
    model_name = ollama_client.DEFAULT_MODEL
    ollama_running = ollama_client.check_ollama_available()
    model_available = ollama_client.check_model_available(model_name) if ollama_running else False

    if not ollama_running:
        msg = "Ollama is NOT running. Start it with: ollama serve"
    elif not model_available:
        msg = f"Ollama is running but model '{model_name}' is not pulled. Run: ollama pull {model_name}"
    else:
        msg = f"Ollama is running and model '{model_name}' is ready."

    return schemas.OllamaHealthResponse(
        ollama_running=ollama_running,
        model_available=model_available,
        model_name=model_name,
        status_message=msg
    )


# ============================================================
# RETRY
# ============================================================

@router.post("/retry/{application_id}", status_code=status.HTTP_202_ACCEPTED)
async def retry_failed_analysis(
    application_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    application = db.query(models.Application).filter(
        models.Application.application_id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    analysis = db.query(models.Analysis).filter(
        models.Analysis.application_id == application_id
    ).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis report not found for this application")

    if not application.cv_path or not os.path.exists(application.cv_path):
        raise HTTPException(status_code=400, detail=f"CV file not found at path: {application.cv_path}. Cannot retry.")

    if not ollama_client.check_ollama_available():
        raise HTTPException(status_code=503, detail="Ollama is not running. Please start with 'ollama serve'.")

    if not ollama_client.check_model_available(ollama_client.DEFAULT_MODEL):
        raise HTTPException(status_code=503, detail=f"Model '{ollama_client.DEFAULT_MODEL}' not available. Run: ollama pull {ollama_client.DEFAULT_MODEL}")

    try:
        # Reset status but KEEP existing partial scores so UI still shows them during retry
        analysis.analysis_status = "Pending"
        analysis.remarks = json.dumps({
            "current_step": "Retrying analysis...",
            "last_updated": "",
            # Preserve partial scores in remarks so frontend knows they existed
        })
        analysis.overall_score = None
        db.commit()

        background_tasks.add_task(
            analyzer_service.run_automatic_analysis,
            application_id=application.application_id,
            cv_path=application.cv_path
        )
        return {"message": f"Analysis for application {application_id} has been successfully queued."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


# ============================================================
# RERUN (new CV upload)
# ============================================================

@router.post("/rerun/{application_id}", status_code=202)
async def rerun_analysis_with_new_cv(
    application_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    application = db.query(models.Application).filter(
        models.Application.application_id == application_id
    ).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded or file has no name.")

    if not os.path.exists(UPLOAD_DIRECTORY):
        os.makedirs(UPLOAD_DIRECTORY)

    file_path = os.path.join(UPLOAD_DIRECTORY, f"rerun_{application_id}_{file.filename}")

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        application.cv_path = file_path

        analysis = db.query(models.Analysis).filter(
            models.Analysis.application_id == application_id
        ).first()

        if analysis:
            analysis.analysis_status = "Pending"
            analysis.remarks = json.dumps({"current_step": "Re-running with new CV..."})
            analysis.overall_score = None
            db.commit()
        else:
            db.rollback()
            raise HTTPException(status_code=404, detail="Analysis report not found")

        background_tasks.add_task(
            analyzer_service.run_automatic_analysis,
            application_id=application.application_id,
            cv_path=file_path
        )
        return {"message": "Analysis re-run triggered with new CV."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


# ============================================================
# GET ANALYSIS STATUS — Enhanced: returns partial scores + current step
# ============================================================

@router.get("/status/{application_id}")
def get_analysis_status(
    application_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns current analysis status INCLUDING any partial scores already computed.
    Frontend polls this every 3s to show real-time step-by-step score reveals.
    """
    analysis = db.query(models.Analysis).filter(
        models.Analysis.application_id == application_id
    ).first()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found for this application")

    # Parse remarks for step info, error, rejection flag
    current_step = None
    error_reason = None
    is_rejection = False

    if analysis.remarks:
        try:
            remarks_data = json.loads(analysis.remarks)
            current_step = remarks_data.get("current_step")

            if analysis.analysis_status == "Failed":
                error_msg = remarks_data.get("error", "Unknown error")
                hint = remarks_data.get("hint", "")
                is_rejection = remarks_data.get("rejection", False)
                error_reason = f"{error_msg}" + (f" | {hint}" if hint else "")
        except Exception:
            current_step = analysis.remarks

    return {
        "application_id": application_id,
        "analysis_status": analysis.analysis_status,
        "current_step": current_step,
        # Partial scores — each is non-null as soon as that step completes
        "careerscore": analysis.careerscore,
        "trustscore": analysis.trustscore,
        "linkedinscore": analysis.linkedinscore,
        "githubscore": analysis.githubscore,
        "leetcodescore": analysis.leetcodescore,
        "jd_match_score": analysis.jd_match_score,
        "overall_score": analysis.overall_score,
        # Error info
        "error_reason": error_reason,
        "is_rejection": is_rejection,
        "analyzed_at": analysis.analyzed_at,
    }


# ============================================================
# MANUAL ANALYZE (synchronous - for testing)
# ============================================================

@router.post("/analyze_cv/", response_model=schemas.AnalysisRead)
async def analyze_candidate_cv_and_save(
    candid: int = Form(...),
    job_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    application = db.query(models.Application).filter(
        models.Application.candid == candid,
        models.Application.job_id == job_id
    ).first()

    if not application:
        raise HTTPException(status_code=404, detail="Application not found.")

    if not os.path.exists(UPLOAD_DIRECTORY):
        os.makedirs(UPLOAD_DIRECTORY)

    file_path = os.path.join(UPLOAD_DIRECTORY, f"{application.application_id}_{file.filename}")

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())

        new_analysis = analyzer_service.analyze_full_candidate_profile(
            application_id=application.application_id,
            candid=candid,
            cv_file_path=file_path,
            db=db,
            job_id=job_id
        )
        return new_analysis
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


# ============================================================
# LIST ALL
# ============================================================

@router.get("/", response_model=List[schemas.AnalysisRead])
def get_all_analysis(db: Session = Depends(get_db)):
    return db.query(models.Analysis).all()


@router.get("/{candid}", response_model=schemas.AnalysisRead)
def get_analysis_by_candidate(candid: int, db: Session = Depends(get_db)):
    analysis = db.query(models.Analysis).filter(models.Analysis.candid == candid).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found for this candidate")
    return analysis
