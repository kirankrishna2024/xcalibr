from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, date


# =============================================================================
# 1. User and Authentication Schemas
# =============================================================================

class CandidateCreate(BaseModel):
    firstname: str
    lastname: str
    email: str
    pass_word: str


class CandidateUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    email: Optional[EmailStr] = None
    contactinfo: Optional[str] = None
    resumelink: Optional[str] = None
    github_link: Optional[str] = None
    sop_link: Optional[str] = None
    leetcode_link: Optional[str] = None
    linkedin_pdf_link: Optional[str] = None   # FIX: was missing
    current_title: Optional[str] = None
    years_of_experience: Optional[str] = None
    professional_summary: Optional[str] = None
    skills: Optional[str] = None


class CandidateRead(BaseModel):
    candid: int
    firstname: str
    lastname: str
    email: str
    contactinfo: Optional[str] = None
    resumelink: Optional[str] = None
    github_link: Optional[str] = None
    sop_link: Optional[str] = None
    linkedin_link: Optional[str] = None
    linkedin_pdf_link: Optional[str] = None
    leetcode_link: Optional[str] = None
    current_title: Optional[str] = None
    years_of_experience: Optional[str] = None
    professional_summary: Optional[str] = None
    skills: Optional[str] = None
    dateregistered: datetime
    applications_count: int = 0
    is_active: bool

    class Config:
        from_attributes = True


class CandidateSimpleRead(BaseModel):
    candid: int
    firstname: str
    lastname: str
    email: str
    application_id: int
    job_id: int
    job_title: str

    class Config:
        from_attributes = True


class CandidateLogin(BaseModel):
    email: str
    pass_word: str


class CandidatePasswordUpdate(BaseModel):
    current_password: str
    new_password: str


# --- HR Schemas ---
class HrCreate(BaseModel):
    firstname: str
    lastname: str
    email: str
    pass_word: str
    designation: Optional[str] = None
    permissions: Optional[str] = None


class HrRead(BaseModel):
    hr_id: int
    firstname: str
    lastname: str
    email: str
    designation: Optional[str] = None
    permissions: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class HrLogin(BaseModel):
    email: str
    pass_word: str


class HrPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class HrUpdate(BaseModel):
    firstname: Optional[str] = None
    lastname: Optional[str] = None
    designation: Optional[str] = None
    permissions: Optional[str] = None


# --- Admin Schemas ---
class AdminCreate(BaseModel):
    firstname: str
    lastname: str
    email: str
    pass_word: str
    organization: Optional[str] = None
    permissions: Optional[str] = None


class AdminRead(BaseModel):
    adminid: int
    firstname: str
    lastname: str
    email: str
    organization: Optional[str] = None
    permissions: Optional[str] = None

    class Config:
        from_attributes = True


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class PasswordResetRequest(BaseModel):
    new_password: str


class HrActivityRead(HrRead):
    total_active_jobs: int = 0
    total_applicants: int = 0
    pending_analyses: int = 0


# =============================================================================
# 2. Core Application Schemas
# =============================================================================

class JobPostingCreate(BaseModel):
    hr_id: int
    title: str
    company_name: str
    description: str
    requirements: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    employment_type: Optional[str] = None
    deadline: Optional[datetime] = None
    analyze_github: Optional[bool] = True
    analyze_leetcode: Optional[bool] = True
    analyze_linkedin: Optional[bool] = True


class JobPostingRead(BaseModel):
    job_id: int
    hr_id: int
    title: str
    company_name: Optional[str] = None
    description: str
    requirements: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    employment_type: Optional[str] = None
    date_posted: datetime
    deadline: Optional[datetime] = None
    status: str
    analyze_github: bool
    analyze_leetcode: bool
    analyze_linkedin: bool
    applicant_count: Optional[int] = 0  # Week 7: for ManageJobsPage cards

    class Config:
        from_attributes = True


class JobSimple(BaseModel):
    job_id: int
    title: str
    company_name: Optional[str] = None

    class Config:
        from_attributes = True


class ApplicationCreate(BaseModel):
    candid: int
    job_id: int
    status: Optional[str] = "Applied"


class ApplicationRead(BaseModel):
    application_id: int
    status: str
    applied_on: datetime
    candidate: CandidateRead
    job: JobPostingRead

    class Config:
        from_attributes = True


class ApplicationForCandidateRead(BaseModel):
    application_id: int
    status: str
    applied_on: datetime
    job: JobPostingRead

    class Config:
        from_attributes = True


# =============================================================================
# 3. Analysis and Scoring Schemas
# =============================================================================

class AnalysisCreate(BaseModel):
    candid: int
    trustscore: Optional[int] = None
    careerscore: Optional[int] = None
    githubscore: Optional[int] = None
    linkedinscore: Optional[int] = None
    remarks: Optional[str] = None
    reportcardlink: Optional[str] = None
    overall_score: Optional[int] = None


class AnalysisRead(BaseModel):
    reportid: int
    candid: int
    trustscore: Optional[int] = None
    careerscore: Optional[int] = None
    githubscore: Optional[int] = None
    linkedinscore: Optional[int] = None
    leetcodescore: Optional[int] = None
    jd_match_score: Optional[int] = None
    remarks: Optional[str] = None
    reportcardlink: Optional[str] = None
    overall_score: Optional[int] = None
    total_possible_score: Optional[int] = None
    feedback: Optional[str] = None
    analysis_status: Optional[str] = None   # FIX: was missing from schema
    analyzed_at: Optional[datetime] = None  # FIX: was missing from schema
    job: Optional[JobSimple] = None

    class Config:
        from_attributes = True


class FeedbackCreateByHR(BaseModel):
    candid: int
    reportid: Optional[int] = None
    content: str
    message_type: str


class FeedbackRead(BaseModel):
    feedbackid: int
    candid: int
    hr_id: Optional[int] = None
    reportid: Optional[int] = None
    content: Optional[str] = None
    message_type: str
    sent_at: datetime
    sender: Optional[HrRead] = None

    class Config:
        from_attributes = True


# --- Ranking Schemas ---
class RankedApplicant(BaseModel):
    rank: int
    application_id: int
    candidate_name: str
    candidate_email: str
    overall_score: Optional[int] = None
    careerscore: Optional[int] = None
    githubscore: Optional[int] = None
    trustscore: Optional[int] = None
    jd_match_score: Optional[int] = None
    leetcodescore: Optional[int] = None
    linkedinscore: Optional[int] = None
    applied_on: datetime
    analysis_status: str
    status: str = "Applied"          # Week 8: application pipeline status (Shortlisted / Rejected etc.)
    cv_path: Optional[str] = None    # resume file path — served via /static/resumes/
    remarks: Optional[str] = None    # AI parsed profile JSON
    fraud_flagged: bool = False
    fraud_reason: Optional[str] = None

    class Config:
        from_attributes = True


class JobRankingsResponse(BaseModel):
    job_id: int
    total_applicants: int
    rankings: List[RankedApplicant]

    class Config:
        from_attributes = True


# =============================================================================
# 4. AI Service Schemas
# =============================================================================

class CVAnalysisResult(BaseModel):
    candidate_name: str
    phone_number: str
    email: str
    comment: str
    degree: List[str]
    experience: List[str]
    technical_skill: List[str]
    responsibility: List[str]
    certificate: List[str]
    soft_skill: List[str]
    job_recommended: List[str]
    office: int
    sql: int


class JobAnalysisResult(BaseModel):
    degree: List[str]
    experience: List[str]
    technical_skill: List[str]
    responsibility: List[str]
    certificate: List[str]
    soft_skill: List[str]


class MatchingRequest(BaseModel):
    candid: int
    job_id: int


class ScoreCommentPair(BaseModel):
    score: int
    comment: str


class MatchingAnalysisResult(BaseModel):
    degree: ScoreCommentPair
    experience: ScoreCommentPair
    technical_skill: ScoreCommentPair
    responsibility: ScoreCommentPair
    certificate: ScoreCommentPair
    soft_skill: ScoreCommentPair
    summary_comment: str
    score: float


# =============================================================================
# 5. System / Dashboard Schemas
# =============================================================================

class SystemLogAdmin(BaseModel):
    adminid: int
    firstname: str
    lastname: str
    email: EmailStr

    class Config:
        from_attributes = True


class SystemLogResponse(BaseModel):
    logid: int
    actiontype: str
    actiondescription: Optional[str] = None
    affectedtable: Optional[str] = None
    timestamped: datetime
    ip_address: Optional[str] = None
    status: Optional[str] = None
    admin: Optional[SystemLogAdmin] = None

    class Config:
        from_attributes = True


class DashboardKPIs(BaseModel):
    active_jobs: int
    total_applicants: int
    new_applicants_weekly: int
    pending_analyses: int


class JobSummary(BaseModel):
    job_id: int
    title: str
    company_name: Optional[str] = None
    location: Optional[str] = None
    status: str
    total_applicants: int
    new_applicants: int
    pending_analyses: int

    class Config:
        from_attributes = True


class ApplicantVolumeData(BaseModel):
    date: date
    count: int


class MessageResponse(BaseModel):
    message: str


# =============================================================================
# 6. Week 6 - NEW: Ollama Health Check Schema
# =============================================================================

class OllamaHealthResponse(BaseModel):
    ollama_running: bool
    model_available: bool
    model_name: str
    status_message: str
