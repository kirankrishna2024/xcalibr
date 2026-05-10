// api.js — Week 7: Multi-Job Management + Enhanced Analysis APIs

import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

const API = axios.create({ baseURL: BASE_URL });

const CandidateAPI = axios.create({ baseURL: BASE_URL });
CandidateAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

const HrAPI = axios.create({ baseURL: BASE_URL });
HrAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem("hr_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

const AdminAPI = axios.create({ baseURL: BASE_URL });
AdminAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));


// ========================================================
// PUBLIC / AUTH
// ========================================================
export const createCandidate     = (data) => API.post("/candidates/", data).then(r => r.data);
export const loginCandidate      = (data) => API.post("/candidates/login", data).then(r => r.data);
export const loginHr             = (data) => API.post("/hr/login", data).then(r => r.data);
export const loginAdmin          = (data) => API.post("/api/admin/login", data).then(r => r.data);
export const getJobs             = ()     => API.get("/jobs/").then(r => r.data);


// ========================================================
// CANDIDATE (protected)
// ========================================================
export const getMe                      = ()         => CandidateAPI.get("/candidates/me").then(r => r.data);
export const updateCandidateProfile     = (data)     => CandidateAPI.put("/candidates/profile", data).then(r => r.data);
export const uploadCandidateResume      = (formData) => CandidateAPI.post("/candidates/upload-resume", formData).then(r => r.data);
export const uploadCandidateLinkedinPdf = (formData) => CandidateAPI.post("/candidates/upload-linkedin-pdf", formData).then(r => r.data);
export const getApplicationsByCandidate = ()         => CandidateAPI.get("/applications/candidate").then(r => r.data);
export const changeCandidatePassword    = (data)     => CandidateAPI.put("/candidates/me/change-password", data).then(r => r.data);
export const deleteCandidateAccount     = ()         => CandidateAPI.delete("/candidates/me").then(r => r.data);
export const createApplication          = (formData) => CandidateAPI.post("/applications/apply", formData).then(r => r.data);
export const getMyFeedback              = ()         => CandidateAPI.get("/candidates/my-feedback").then(r => r.data);


// ========================================================
// HR (protected)
// ========================================================
export const getHrMe                    = ()         => HrAPI.get("/hr/me").then(r => r.data);
export const getJobsByHr                = (hr_id)    => HrAPI.get(`/hr/${hr_id}/jobs`).then(r => r.data);
export const getRankedApplicantsForJob  = (job_id)   => HrAPI.get(`/hr-views/jobs/${job_id}/rankings`).then(r => r.data);
export const getDashboardKpis           = ()         => HrAPI.get("/hr/dashboard/kpis").then(r => r.data);
export const getDashboardJobSummaries   = ()         => HrAPI.get("/hr/dashboard/job-summaries").then(r => r.data);
export const getDashboardApplicantVolume= ()         => HrAPI.get("/hr/dashboard/applicant-volume").then(r => r.data);
export const retryAnalysis              = (appId)    => HrAPI.post(`/analysis/retry/${appId}`).then(r => r.data);
export const rerunAnalysis              = (appId, cvFile) => {
  const formData = new FormData();
  formData.append("file", cvFile);
  return HrAPI.post(`/analysis/rerun/${appId}`, formData).then(r => r.data);
};
export const changeHrPassword           = (hrId, data) => HrAPI.put(`/hr/${hrId}/change-password`, data).then(r => r.data);
export const deleteHrAccount            = (hrId)     => HrAPI.delete(`/hr/${hrId}`).then(r => r.data);
export const getAllHrApplicants          = ()         => HrAPI.get("/hr/my-applicants/list").then(r => r.data);
export const getAvailableReports        = (candid)   => HrAPI.get(`/hr/my-applicants/reports/${candid}`).then(r => r.data);
export const sendFeedback               = (data)     => HrAPI.post("/hr/feedback", data).then(r => r.data);
export const checkOllamaHealth          = ()         => HrAPI.get("/analysis/health/ollama").then(r => r.data);
export const getAnalysisStatus          = (appId)    => HrAPI.get(`/analysis/status/${appId}`).then(r => r.data);

// ─── WEEK 7: Full Job CRUD ────────────────────────────────────────────────────
export const createJob       = (jobData)        => HrAPI.post("/jobs/", jobData).then(r => r.data);
export const updateJob       = (jobId, jobData) => HrAPI.put(`/jobs/${jobId}`, jobData).then(r => r.data);
export const deleteJob       = (jobId)          => HrAPI.delete(`/jobs/${jobId}`).then(r => r.data);
export const toggleJobStatus = (jobId, status)  => HrAPI.patch(`/jobs/${jobId}/status`, { status }).then(r => r.data);
export const updateApplicationStatus = (appId, appStatus) => HrAPI.put(`/applications/${appId}/status`, null, { params: { application_status: appStatus } }).then(r => r.data);
export const getUnreadFeedbackCount = () => CandidateAPI.get("/candidates/my-feedback/unread-count").then(r => r.data);

export { BASE_URL };


// ========================================================
// ADMIN (protected)
// ========================================================
export const getAdminMe                  = ()          => AdminAPI.get("/api/admin/me").then(r => r.data);
export const getAdminDashboardKpis       = ()          => AdminAPI.get("/admin-dashboard/kpis").then(r => r.data);
export const getAdminHrActivity          = ()          => AdminAPI.get("/admin-dashboard/hr-activity").then(r => r.data);
export const createHr                    = (data)      => AdminAPI.post("/hr/", data).then(r => r.data);
export const getAllHrUsers                = ()          => AdminAPI.get("/api/admin/hr").then(r => r.data);
export const suspendHr                   = (hrId)      => AdminAPI.post(`/api/admin/hr/${hrId}/suspend`).then(r => r.data);
export const activateHr                  = (hrId)      => AdminAPI.post(`/api/admin/hr/${hrId}/activate`).then(r => r.data);
export const deleteHr                    = (hrId)      => AdminAPI.delete(`/api/admin/hr/${hrId}`).then(r => r.data);
export const getAllCandidates             = ()          => AdminAPI.get("/api/admin/candidates").then(r => r.data);
export const suspendCandidate            = (candId)    => AdminAPI.post(`/api/admin/candidates/${candId}/suspend`).then(r => r.data);
export const activateCandidate           = (candId)    => AdminAPI.post(`/api/admin/candidates/${candId}/activate`).then(r => r.data);
export const deleteCandidate             = (candId)    => AdminAPI.delete(`/api/admin/candidates/${candId}`).then(r => r.data);
export const adminResetHrPassword        = (hrId, pw)  => AdminAPI.put(`/api/admin/hr/${hrId}/reset-password`, { new_password: pw }).then(r => r.data);
export const adminResetCandidatePassword = (cId, pw)   => AdminAPI.put(`/api/admin/candidates/${cId}/reset-password`, { new_password: pw }).then(r => r.data);
export const getSystemLogs               = ()          => AdminAPI.get("/api/admin/system-logs").then(r => r.data);
export const flagCandidateAsFraud        = (candId)    => AdminAPI.post(`/api/admin/candidates/${candId}/flag-fraud`).then(r => r.data);
export const unflagCandidateFraud        = (candId)    => AdminAPI.post(`/api/admin/candidates/${candId}/unflag-fraud`).then(r => r.data);

// ─── WEEK 8: Shortlist & Reject ───────────────────────────────────────────────
export const shortlistApplication = (appId) => HrAPI.post(`/applications/${appId}/shortlist`).then(r => r.data);
export const rejectApplication    = (appId) => HrAPI.post(`/applications/${appId}/reject`).then(r => r.data);

// ─── Resume / CV URLs ─────────────────────────────────────────────────────────
// Use these helpers instead of building raw /static/... URLs.
// The preview endpoint serves inline (for iframe/new-tab).
// The download endpoint forces a file download.
export const getResumePreviewUrl  = (candidateId) => `${BASE_URL}/candidates/resume/${candidateId}/preview`;
export const getResumeDownloadUrl = (candidateId) => `${BASE_URL}/candidates/resume/${candidateId}`;
export const getCvPreviewUrl      = (applicationId) => `${BASE_URL}/candidates/cv-file/${applicationId}/preview`;
