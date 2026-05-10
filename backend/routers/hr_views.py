# routers/hr_views.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from database import get_db
import models, schemas

router = APIRouter(prefix="/hr-views", tags=["HR Views"])


@router.get("/jobs/{job_id}/rankings", response_model=schemas.JobRankingsResponse)
def get_job_rankings(
    job_id: int,
    db: Session = Depends(get_db)
):
    """
    Get ranked applicants for a specific job.
    Ranking is calculated on-the-fly from the overall_score in the Analysis table.
    Applications with NO analysis record yet are also included as 'Pending'.
    """
    # 1. Check job exists
    job = db.query(models.JobPosting).filter(models.JobPosting.job_id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 2. Get all applications for this job (even without analysis)
    all_applications = db.query(
        models.Application,
        models.Candidates
    ).join(
        models.Candidates, models.Application.candid == models.Candidates.candid
    ).filter(
        models.Application.job_id == job_id
    ).all()

    # 3. Get all analysis records for this job
    analyses = db.query(models.Analysis).filter(
        models.Analysis.job_id == job_id
    ).all()
    analysis_map = {a.application_id: a for a in analyses}

    # 4. Build list: applications WITH completed scores first (sorted), then pending
    scored = []
    pending = []

    for application, candidate in all_applications:
        analysis = analysis_map.get(application.application_id)

        # Server-side fraud detection:
        # Flag if trust=0 AND career<=10 AND overall<=20 (fake/fabricated profile)
        trust = analysis.trustscore if analysis else None
        career = analysis.careerscore if analysis else None
        overall = analysis.overall_score if analysis else None
        is_completed = analysis and analysis.analysis_status == "Completed"

        fraud_flagged = False
        fraud_reason = None
        if is_completed and trust is not None and career is not None:
            if trust <= 5 and career <= 10 and (overall or 0) <= 20:
                fraud_flagged = True
                fraud_reason = "Extremely low Trust Index & Career Readiness — skills unverifiable across all platforms."
            elif trust == 0 and (overall or 0) == 0:
                fraud_flagged = True
                fraud_reason = "Zero trust score and zero overall — likely fabricated candidate profile."

        entry = {
            "application_id": application.application_id,
            "candidate_name": f"{candidate.firstname} {candidate.lastname}",
            "candidate_email": candidate.email,
            "applied_on": application.applied_on,
            "status": application.status,                          # pipeline status: Shortlisted / Rejected etc.
            "cv_path": application.cv_path,
            "overall_score": analysis.overall_score if analysis else None,
            "careerscore": analysis.careerscore if analysis else None,
            "githubscore": analysis.githubscore if analysis else None,
            "trustscore": analysis.trustscore if analysis else None,
            "jd_match_score": analysis.jd_match_score if analysis else None,
            "leetcodescore": analysis.leetcodescore if analysis else None,
            "linkedinscore": analysis.linkedinscore if analysis else None,
            "analysis_status": analysis.analysis_status if analysis else "Pending",
            "remarks": analysis.remarks if analysis else None,     # AI-parsed profile JSON
            "fraud_flagged": fraud_flagged,
            "fraud_reason": fraud_reason,
        }

        if analysis and analysis.analysis_status == "Completed" and analysis.overall_score is not None:
            scored.append(entry)
        else:
            pending.append(entry)

    # 5. Sort scored by overall_score descending
    scored.sort(key=lambda x: x["overall_score"], reverse=True)

    # 6. Assign ranks and combine
    formatted_rankings = []
    for rank, entry in enumerate(scored + pending, start=1):
        entry["rank"] = rank
        formatted_rankings.append(entry)

    return {
        "job_id": job_id,
        "total_applicants": len(formatted_rankings),
        "rankings": formatted_rankings
    }


@router.get("/candidates/scores", response_model=List[schemas.AnalysisRead])
def list_candidates_scores(db: Session = Depends(get_db)):
    """Returns a list of all analysis scores."""
    return db.query(models.Analysis).all()


@router.get("/candidate/{candid}", response_model=schemas.CandidateRead)
def get_candidate_full_details(candid: int, db: Session = Depends(get_db)):
    """Returns full candidate details by candidate ID."""
    candidate = db.query(models.Candidates).filter(models.Candidates.candid == candid).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.get("/candidate/{candid}/score", response_model=schemas.AnalysisRead)
def get_candidate_score(candid: int, db: Session = Depends(get_db)):
    """Returns analysis/score of a single candidate."""
    analysis = db.query(models.Analysis).filter(models.Analysis.candid == candid).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found for candidate")
    return analysis
