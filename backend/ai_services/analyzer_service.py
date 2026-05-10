# ai_services/analyzer_service.py
# Enhanced: Each score written to DB immediately after computed — real-time partial updates
import json
import os
from sqlalchemy.orm import Session
import logging
import datetime
import traceback
from typing import Dict, Any, Set

from database import sessionLocal
import models
from . import utils, prompts
from . import jd_matching_service
from . import feedback_service
from .llm_clients import ollama_client

from .External_profile_services import github_service, leetcode_service, linkedin_service

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def _analyze_cv_text(cv_content: str) -> dict:
    """Analyzes CV text using Ollama. Raises ValueError/RuntimeError on failure."""
    logger.info("Analyzing CV content using Ollama...")
    try:
        parsed_json = ollama_client.invoke_ollama_json(
            model_name="llama3",
            system_prompt=prompts.system_prompt_candidate,
            user_content=cv_content,
            temperature=0.3
        )
        required_keys = ["candidate_name", "email", "degree", "experience", "technical_skill", "certifications"]
        missing = [k for k in required_keys if k not in parsed_json]
        if missing:
            logger.warning(f"Ollama CV analysis JSON missing keys: {missing}. Proceeding with partial data.")
        logger.info("Successfully parsed JSON from Ollama CV analysis.")
        return parsed_json
    except (ValueError, RuntimeError) as e:
        logger.error(f"Ollama CV analysis failed: {e}", exc_info=True)
        raise


def _calculate_career_readiness(analysis_data: dict) -> dict:
    """Calculates the career readiness score based on CV data."""
    scores = {"experience_score": 0, "skills_score": 0, "education_score": 0, "certifications_score": 0}

    total_experience_months = sum(
        exp.get("duration_months", 0)
        for exp in analysis_data.get("experience", [])
        if isinstance(exp, dict)
    )
    if total_experience_months >= 60:
        scores["experience_score"] = 40
    elif total_experience_months >= 36:
        scores["experience_score"] = 30
    elif total_experience_months >= 12:
        scores["experience_score"] = 20
    elif total_experience_months > 0:
        scores["experience_score"] = 10

    num_technical_skills = len(analysis_data.get("technical_skill", []))
    num_soft_skills = len(analysis_data.get("soft_skill", []))
    scores["skills_score"] = min(num_technical_skills * 3, 30) + min(num_soft_skills * 2, 10)

    degrees = analysis_data.get("degree", [])
    if any("phd" in str(d).lower() for d in degrees):
        scores["education_score"] = 15
    elif any("master" in str(d).lower() for d in degrees):
        scores["education_score"] = 12
    elif any("bachelor" in str(d).lower() for d in degrees):
        scores["education_score"] = 8
    elif degrees:
        scores["education_score"] = 3

    scores["certifications_score"] = min(len(analysis_data.get("certifications", [])) * 1, 5)

    total_score = sum(scores.values())
    logger.info(f"Career Readiness Score: {total_score}/100. Breakdown: {scores}")
    return {"total_score": total_score, "score_breakdown": scores}


def _calculate_trust_index(
    cv_data: Dict[str, Any],
    github_data: Dict[str, Any],
    linkedin_data: Dict[str, Any]
) -> int:
    """Calculates the Trust Index Score (0-50)."""
    trust_score = 0
    logger.info("Calculating Trust Index Score...")
    try:
        cv_name = cv_data.get("candidate_name", "").lower().strip()
        li_name = linkedin_data.get("linkedin_data", {}).get("profile_name", "").lower().strip()
        if cv_name and li_name:
            if cv_name == li_name:
                trust_score += 10
            elif cv_name in li_name or li_name in cv_name:
                trust_score += 5

        cv_email = cv_data.get("email", "").lower().strip()
        li_email = linkedin_data.get("linkedin_data", {}).get("email", "").lower().strip()
        if cv_email and li_email and cv_email == li_email:
            trust_score += 10

        cv_skills_set = {str(skill).lower() for skill in cv_data.get("technical_skill", [])}

        github_languages_set: Set[str] = set()
        for repo in github_data.get("repos", []):
            github_languages_set.update(str(lang).lower() for lang in repo.get("languages_detailed", []))

        verified_git_skills = cv_skills_set.intersection(github_languages_set)
        if verified_git_skills:
            trust_score += min(len(verified_git_skills) * 3, 15)

        li_skills_set = {str(s).lower() for s in linkedin_data.get("linkedin_data", {}).get("skills", [])}
        verified_li_skills = cv_skills_set.intersection(li_skills_set)
        if verified_li_skills:
            trust_score += min(len(verified_li_skills) * 3, 15)

    except Exception as e:
        logger.error(f"Error during Trust Index calculation: {e}", exc_info=True)

    final_trust_score = max(0, min(trust_score, 50))
    logger.info(f"Trust Index Score: {final_trust_score}/50")
    return final_trust_score


def _save_partial_scores(db: Session, application_id: int, step_label: str, **score_fields):
    """
    KEY FIX: Immediately writes partial scores to DB after each pipeline step.
    Also updates the current_step in remarks so frontend polling shows live progress.
    This is what enables real-time score display.
    """
    try:
        analysis = db.query(models.Analysis).filter(
            models.Analysis.application_id == application_id
        ).first()
        if not analysis:
            return

        # Write each score field immediately
        for field, value in score_fields.items():
            if hasattr(analysis, field) and value is not None:
                setattr(analysis, field, value)

        # Update remarks with structured progress info
        try:
            current_remarks = json.loads(analysis.remarks) if analysis.remarks else {}
        except Exception:
            current_remarks = {}

        current_remarks["current_step"] = step_label
        current_remarks["last_updated"] = datetime.datetime.now(datetime.UTC).isoformat()
        analysis.remarks = json.dumps(current_remarks)

        db.commit()
        logger.info(f"Saved partial scores for app {application_id} at step: {step_label} | {score_fields}")
    except Exception as e:
        logger.error(f"Failed to save partial scores at step '{step_label}': {e}")
        try:
            db.rollback()
        except Exception:
            pass


def run_automatic_analysis(application_id: int, cv_path: str):
    """
    Background task. Differentiates business rejections from technical failures.
    Each step writes its score immediately — no waiting for end.
    """
    db: Session = sessionLocal()
    try:
        logger.info(f"Background analysis started for application_id: {application_id}")

        analysis = db.query(models.Analysis).filter(
            models.Analysis.application_id == application_id
        ).first()

        if not analysis:
            logger.error(f"No analysis record found for application_id: {application_id}")
            return

        analysis.analysis_status = "In Progress"
        analysis.remarks = json.dumps({"current_step": "Initializing analysis pipeline...", "last_updated": datetime.datetime.now(datetime.UTC).isoformat()})
        db.commit()

        updated_analysis = analyze_full_candidate_profile(
            candid=analysis.candid,
            cv_file_path=cv_path,
            db=db,
            application_id=application_id,
            job_id=analysis.job_id
        )

        updated_analysis.analysis_status = "Completed"
        updated_analysis.analyzed_at = datetime.datetime.now(datetime.UTC)
        db.commit()
        logger.info(f"Successfully completed analysis for application_id: {application_id}")

    except ValueError as ve:
        # Business logic rejection (JD mismatch, fake profile)
        db.rollback()
        error_msg = str(ve)
        logger.warning(f"CANDIDATE REJECTED for application_id {application_id}: {error_msg}")
        try:
            analysis_failsafe = db.query(models.Analysis).filter(
                models.Analysis.application_id == application_id
            ).first()
            if analysis_failsafe:
                analysis_failsafe.analysis_status = "Failed"
                # Keep any partial scores already saved — don't wipe them
                try:
                    existing = json.loads(analysis_failsafe.remarks) if analysis_failsafe.remarks else {}
                except Exception:
                    existing = {}
                existing["error"] = error_msg
                existing["rejection"] = True
                existing["hint"] = "This candidate does not meet the minimum criteria or has an incomplete/fake profile."
                analysis_failsafe.remarks = json.dumps(existing)
                db.commit()
        except Exception as db_err:
            logger.error(f"Failed to update rejection status: {db_err}")
            db.rollback()

    except Exception as e:
        # Technical crash (Ollama timeout, DB error, etc.)
        db.rollback()
        error_msg = str(e)
        logger.error(f"CRITICAL TECHNICAL ERROR for application_id: {application_id}")
        logger.error(traceback.format_exc())
        try:
            analysis_failsafe = db.query(models.Analysis).filter(
                models.Analysis.application_id == application_id
            ).first()
            if analysis_failsafe:
                analysis_failsafe.analysis_status = "Failed"
                try:
                    existing = json.loads(analysis_failsafe.remarks) if analysis_failsafe.remarks else {}
                except Exception:
                    existing = {}
                existing["error"] = f"Technical Failure: {error_msg}"
                existing["rejection"] = False
                existing["hint"] = "Check Ollama status (ollama serve) and ensure llama3 is pulled."
                analysis_failsafe.remarks = json.dumps(existing)
                db.commit()
        except Exception as db_err:
            logger.error(f"Failed to update technical failure status: {db_err}")
            db.rollback()
    finally:
        db.close()


def analyze_full_candidate_profile(
    candid: int,
    cv_file_path: str,
    db: Session,
    application_id: int,
    job_id: int
) -> models.Analysis:
    """
    Full analysis pipeline. Each score is written to DB immediately after computation
    so the frontend can show real-time partial results via polling.
    """
    logger.info(f"Starting analysis for candid: {candid}, app_id: {application_id}")

    candidate = db.query(models.Candidates).filter(models.Candidates.candid == candid).first()
    if not candidate:
        raise ValueError("Candidate not found in the database")

    job = db.query(models.JobPosting).filter(models.JobPosting.job_id == job_id).first()
    if not job:
        raise ValueError("Job not found in the database")

    # Anti-fake check: incomplete profile
    if not candidate.professional_summary or len(candidate.professional_summary) < 50:
        raise ValueError("Analysis prohibited: Candidate profile is incomplete or appears fake (Missing Professional Summary).")

    total_possible_score = 250

    # ── STEP 1: CV Analysis (Ollama) ─────────────────────────────────────────
    _save_partial_scores(db, application_id, "Step 1/6: Extracting CV with llama3...")
    try:
        cv_content = utils.read_cv(cv_file_path)
        cv_analysis_data = _analyze_cv_text(cv_content)
        if not cv_analysis_data.get("technical_skill"):
            raise ValueError("Fake Candidate Detected: Resume contains no valid technical skills.")
    except ValueError:
        raise
    except Exception as e:
        raise RuntimeError(f"CV analysis failed: {e}") from e

    # ── STEP 2: Career Readiness — save immediately ───────────────────────────
    _save_partial_scores(db, application_id, "Step 2/6: Calculating Career Readiness...")
    readiness_score_data = _calculate_career_readiness(cv_analysis_data)
    final_careerscore = readiness_score_data.get('total_score', 0)
    # Write careerscore to DB right now
    _save_partial_scores(db, application_id, "Step 2/6: Career Readiness ✓", careerscore=final_careerscore)

    # ── STEP 3: LinkedIn — save immediately ───────────────────────────────────
    linkedin_profile_score = 0
    linkedin_analysis = {}
    if job.analyze_linkedin:
        _save_partial_scores(db, application_id, "Step 3/6: Analyzing LinkedIn PDF...")
        total_possible_score += 50
        linkedin_pdf_filename = getattr(candidate, 'linkedin_pdf_link', None)
        if linkedin_pdf_filename:
            try:
                base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
                linkedin_pdf_path = os.path.join(base_dir, "uploaded_linkedin_pdfs", os.path.basename(linkedin_pdf_filename))
                if os.path.exists(linkedin_pdf_path):
                    linkedin_pdf_content = utils.read_cv(linkedin_pdf_path)
                    if linkedin_pdf_content:
                        linkedin_analysis = linkedin_service.analyze_linkedin_pdf_text(linkedin_pdf_content)
                        linkedin_profile_score = linkedin_analysis.get("linkedin_score", 0)
            except Exception as e:
                logger.error(f"LinkedIn analysis error: {e}")
        # Save LinkedIn score immediately
        _save_partial_scores(db, application_id, "Step 3/6: LinkedIn ✓", linkedinscore=linkedin_profile_score)
    else:
        _save_partial_scores(db, application_id, "Step 3/6: LinkedIn (skipped)", linkedinscore=0)

    # ── STEP 4: GitHub — save immediately ─────────────────────────────────────
    github_profile_score = 0
    github_analysis = {}
    if job.analyze_github:
        _save_partial_scores(db, application_id, "Step 4/6: Fetching GitHub profile...")
        total_possible_score += 100
        if candidate.github_link:
            github_username = github_service.get_github_username(candidate.github_link)
            if github_username:
                try:
                    github_analysis = github_service.analyze_github_profile(github_username)
                    github_profile_score = github_analysis.get("github_score", 0)
                except Exception as e:
                    logger.error(f"GitHub analysis error: {e}")
        # Save GitHub score immediately
        _save_partial_scores(db, application_id, "Step 4/6: GitHub ✓", githubscore=github_profile_score)
    else:
        _save_partial_scores(db, application_id, "Step 4/6: GitHub (skipped)", githubscore=0)

    # ── STEP 5: LeetCode — save immediately ───────────────────────────────────
    leetcode_profile_score = 0
    leetcode_analysis = {}
    if job.analyze_leetcode:
        _save_partial_scores(db, application_id, "Step 5/6: Checking LeetCode stats...")
        total_possible_score += 100
        if candidate.leetcode_link:
            leetcode_username = leetcode_service.get_leetcode_username(candidate.leetcode_link)
            if leetcode_username:
                try:
                    leetcode_analysis = leetcode_service.analyze_leetcode_profile(leetcode_username)
                    leetcode_profile_score = leetcode_analysis.get("leetcode_score", 0)
                except Exception as e:
                    logger.error(f"LeetCode analysis error: {e}")
        # Save LeetCode score immediately
        _save_partial_scores(db, application_id, "Step 5/6: LeetCode ✓", leetcodescore=leetcode_profile_score)
    else:
        _save_partial_scores(db, application_id, "Step 5/6: LeetCode (skipped)", leetcodescore=0)

    # ── STEP 6a: JD Match ─────────────────────────────────────────────────────
    _save_partial_scores(db, application_id, "Step 6/6: Matching CV against Job Description...")
    jd_match_score = 0
    jd_match_result = {}
    try:
        jd_analysis_data = jd_matching_service.analyze_job_description(job.description)
        jd_match_result = jd_matching_service.get_match_analysis(cv_analysis=cv_analysis_data, jd_analysis=jd_analysis_data)
        jd_match_score = jd_match_result.get("match_score", 0)
        cv_analysis_data["jd_match"] = jd_match_result

        if jd_match_score < 20:
            raise ValueError(f"MISMATCH REJECTION: Candidate match score is only {jd_match_score}%. Minimum 20% required.")
    except ValueError as ve:
        raise ve
    except Exception as e:
        logger.error(f"JD Match analysis error: {e}")

    # ── STEP 6b: Trust Index — save immediately ───────────────────────────────
    _save_partial_scores(db, application_id, "Step 6/6: Calculating Trust Index...")
    trust_index_score = _calculate_trust_index(
        cv_data=cv_analysis_data,
        github_data=github_analysis,
        linkedin_data=linkedin_analysis
    )
    # Save trust + jd_match immediately
    _save_partial_scores(
        db, application_id,
        "Step 6/6: Trust Index ✓",
        trustscore=trust_index_score,
        jd_match_score=jd_match_score
    )

    # ── Final: Compute overall & save all ─────────────────────────────────────
    final_overall_score = (
        final_careerscore + jd_match_score + github_profile_score +
        leetcode_profile_score + linkedin_profile_score + trust_index_score
    )

    existing_analysis = db.query(models.Analysis).filter(
        models.Analysis.application_id == application_id
    ).first()

    analysis_data_to_save = {
        "candid": candid, "job_id": job_id, "application_id": application_id,
        "careerscore": final_careerscore,
        "githubscore": github_profile_score,
        "trustscore": trust_index_score,
        "leetcodescore": leetcode_profile_score,
        "linkedinscore": linkedin_profile_score,
        "jd_match_score": jd_match_score,
        "remarks": json.dumps(cv_analysis_data),
        "overall_score": final_overall_score,
        "total_possible_score": total_possible_score
    }

    if existing_analysis:
        for key, value in analysis_data_to_save.items():
            setattr(existing_analysis, key, value)
        analysis_report = existing_analysis
    else:
        analysis_report = models.Analysis(**analysis_data_to_save)
        db.add(analysis_report)

    # Generate feedback
    _save_partial_scores(db, application_id, "Finalizing: Generating AI feedback...")
    try:
        feedback_text = feedback_service.generate_hr_feedback(
            analysis_data=cv_analysis_data, db_report=analysis_report, job=job
        )
        analysis_report.feedback = feedback_text
    except Exception as fb_err:
        analysis_report.feedback = json.dumps({"error": f"Feedback failed: {str(fb_err)}"})

    try:
        db.commit()
        db.refresh(analysis_report)
        logger.info(f"Saved final analysis report for app_id {application_id}")
    except Exception as e:
        db.rollback()
        raise RuntimeError(f"Failed to save analysis report: {e}")

    return analysis_report
