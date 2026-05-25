"""Backend integration tests for PESO-Link MisOr."""
import time
import uuid
import requests
import pytest
from conftest import BASE_URL, headers


# ---------------- Health ----------------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "PESO" in data["service"]


# ---------------- Auth ----------------
class TestAuth:
    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_login_seeker(self, seeker_token):
        assert seeker_token

    def test_login_employer(self, employer_token):
        assert employer_token

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "admin@peso.gov.ph", "password": "wrong"})
        assert r.status_code == 401

    def test_me_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "admin"

    def test_me_seeker_has_profile(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers(seeker_token))
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "job_seeker"
        assert data["profile"] is not None

    def test_register_job_seeker(self):
        email = f"TEST_seeker_{uuid.uuid4().hex[:8]}@test.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Test@123", "role": "job_seeker",
            "profile": {"first_name": "TEST", "last_name": "Seeker", "contact_number": "09171234567"}
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["user"]["role"] == "job_seeker"
        assert body["user"]["account_status"] == "active"
        assert "token" in body

    def test_register_employer_blocked(self):
        # Scope update: employer self-registration is no longer allowed.
        email = f"TEST_emp_{uuid.uuid4().hex[:8]}@test.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Test@123", "role": "employer",
            "profile": {"company_name": "TEST Corp", "contact_person": "John"}
        })
        assert r.status_code == 400, r.text
        assert "admin" in r.json().get("error", "").lower()

    def test_register_duplicate(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": "juan.cruz@example.com", "password": "Test@123", "role": "job_seeker"
        })
        assert r.status_code == 409

    def test_invalid_jwt(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer bad.token.here"})
        assert r.status_code == 401


# ---------------- Job Seeker profile ----------------
class TestJobSeeker:
    def test_get_profile(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/job-seeker/profile", headers=headers(seeker_token))
        assert r.status_code == 200
        assert "profile" in r.json() or r.json()  # tolerate envelope

    def test_update_profile(self, seeker_token):
        payload = {
            "first_name": "Juan", "last_name": "Cruz",
            "date_of_birth": "1998-05-15",
            "contact_number": "09170000001", "address": "CDO",
            "city": "Cagayan de Oro", "province": "Misamis Oriental",
            "education_level": "Bachelor's", "course": "BSIT"
        }
        r = requests.post(f"{BASE_URL}/api/job-seeker/profile",
                          headers=headers(seeker_token), json=payload)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body["profile"]["profile_completed"] in (1, True)

    def test_skills_replace(self, seeker_token):
        rs = requests.get(f"{BASE_URL}/api/skills", headers=headers(seeker_token))
        assert rs.status_code == 200
        skills = rs.json().get("skills", [])
        assert len(skills) > 0
        payload = {"skills": [{"skill_id": s["id"], "proficiency_level": "intermediate"}
                              for s in skills[:3]]}
        r = requests.post(f"{BASE_URL}/api/job-seeker/skills",
                          headers=headers(seeker_token), json=payload)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert len(body["skills"]) == 3


# ---------------- NSRP OCR ----------------
class TestNSRP:
    def test_extract_simulated(self, seeker_token):
        # Upload first (real OCR contract: extract needs upload_id)
        png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        ru = requests.post(f"{BASE_URL}/api/nsrp/upload",
                           headers=headers(seeker_token),
                           json={"image_base64": png_b64})
        assert ru.status_code == 201, ru.text
        upload_id = ru.json()["upload_id"]
        r = requests.post(f"{BASE_URL}/api/nsrp/extract",
                          headers=headers(seeker_token),
                          json={"upload_id": upload_id}, timeout=90)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "extracted_data" in body
        assert "notice" in body

    def test_confirm_save(self, seeker_token):
        confirmed_data = {
            "first_name": "Juan", "last_name": "Cruz",
            "date_of_birth": "1998-05-15", "contact_number": "09170000001",
            "address": "CDO", "city": "Cagayan de Oro", "province": "Misamis Oriental",
            "education_level": "Bachelor's", "course": "BSIT",
            "years_of_experience": 2, "employment_status": "unemployed",
            "preferred_occupation": "Software Developer"
        }
        r = requests.post(f"{BASE_URL}/api/nsrp/confirm",
                          headers=headers(seeker_token),
                          json={"confirmed_data": confirmed_data})
        assert r.status_code in (200, 201), r.text


# ---------------- Jobs ----------------
class TestJobs:
    def test_list_jobs(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=headers(seeker_token))
        assert r.status_code == 200
        jobs = r.json()["jobs"]
        assert isinstance(jobs, list)
        # All jobs from approved employers
        for j in jobs:
            assert j["status"] == "active"

    def test_search_jobs(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/jobs?search=developer",
                         headers=headers(seeker_token))
        assert r.status_code == 200

    def test_job_details(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=headers(seeker_token))
        job_id = r.json()["jobs"][0]["id"]
        r2 = requests.get(f"{BASE_URL}/api/jobs/{job_id}",
                          headers=headers(seeker_token))
        assert r2.status_code == 200
        job = r2.json()["job"]
        assert "required_skills" in job

    def test_skill_match(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=headers(seeker_token))
        job_id = r.json()["jobs"][0]["id"]
        rm = requests.get(f"{BASE_URL}/api/jobs/{job_id}/match",
                          headers=headers(seeker_token))
        assert rm.status_code == 200
        data = rm.json()
        assert "matched_skills" in data
        assert "unmatched_required_skills" in data
        # No ranking key
        assert "score" not in data and "rank" not in data

    def test_match_forbidden_for_employer(self, employer_token):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=headers(employer_token))
        if r.status_code == 200 and r.json().get("jobs"):
            job_id = r.json()["jobs"][0]["id"]
            rm = requests.get(f"{BASE_URL}/api/jobs/{job_id}/match",
                              headers=headers(employer_token))
            assert rm.status_code == 403


# ---------------- Applications ----------------
class TestApplications:
    def test_my_applications(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/applications/my-applications",
                         headers=headers(seeker_token))
        assert r.status_code == 200
        apps = r.json()["applications"]
        assert isinstance(apps, list)

    def test_duplicate_application_rejected(self, seeker_token):
        # juan already applied to a job - try same job
        r = requests.get(f"{BASE_URL}/api/applications/my-applications",
                         headers=headers(seeker_token))
        apps = r.json()["applications"]
        if apps:
            job_post_id = apps[0]["job_post_id"]
            r2 = requests.post(f"{BASE_URL}/api/applications",
                               headers=headers(seeker_token),
                               json={"job_post_id": job_post_id,
                                     "cover_letter": "test"})
            assert r2.status_code == 409

    def test_application_detail(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/applications/my-applications",
                         headers=headers(seeker_token))
        apps = r.json()["applications"]
        if apps:
            app_id = apps[0]["id"]
            r2 = requests.get(f"{BASE_URL}/api/applications/{app_id}",
                              headers=headers(seeker_token))
            assert r2.status_code == 200
            body = r2.json()
            assert "application" in body and "history" in body


# ---------------- Employer ----------------
class TestEmployer:
    def test_employer_profile(self, employer_token):
        r = requests.get(f"{BASE_URL}/api/employer/profile",
                         headers=headers(employer_token))
        assert r.status_code == 200

    def test_employer_jobs_list(self, employer_token):
        r = requests.get(f"{BASE_URL}/api/employer/jobs",
                         headers=headers(employer_token))
        assert r.status_code == 200
        jobs = r.json()["jobs"]
        for j in jobs:
            assert "applicant_count" in j

    def test_pending_employer_cannot_post(self, pending_employer_token):
        r = requests.post(f"{BASE_URL}/api/employer/jobs",
                          headers=headers(pending_employer_token),
                          json={"job_title": "Test", "job_description": "Test",
                                "job_type": "full_time", "location": "CDO"})
        assert r.status_code == 403

    def test_employer_create_update_close_job(self, employer_token):
        # Create
        payload = {
            "job_title": "TEST QA Engineer",
            "job_description": "Quality assurance role",
            "job_type": "full-time",
            "location": "Cagayan de Oro",
            "salary_min": 20000, "salary_max": 30000,
            "required_skills": [],
        }
        r = requests.post(f"{BASE_URL}/api/employer/jobs",
                          headers=headers(employer_token), json=payload)
        assert r.status_code in (200, 201), r.text
        body = r.json()
        job_id = body.get("job_id") or body.get("id") or body.get("job", {}).get("id")
        assert job_id

        # Update
        ru = requests.put(f"{BASE_URL}/api/employer/jobs/{job_id}",
                          headers=headers(employer_token),
                          json={**payload, "job_title": "TEST QA Engineer V2"})
        assert ru.status_code in (200, 204), ru.text

        # Get applicants
        ra = requests.get(f"{BASE_URL}/api/employer/jobs/{job_id}/applicants",
                          headers=headers(employer_token))
        assert ra.status_code == 200

        # Close, not hard-delete
        rc = requests.put(f"{BASE_URL}/api/employer/jobs/{job_id}/close",
                          headers=headers(employer_token))
        assert rc.status_code in (200, 204)

        rj = requests.get(f"{BASE_URL}/api/employer/jobs",
                          headers=headers(employer_token))
        assert rj.status_code == 200
        closed = [j for j in rj.json()["jobs"] if j["id"] == job_id]
        assert closed
        assert closed[0]["status"] == "closed"

    def test_application_status_update_valid_and_invalid_enum(self, employer_token):
        # find an applicant in employer's jobs
        rj = requests.get(f"{BASE_URL}/api/employer/jobs",
                          headers=headers(employer_token))
        jobs = rj.json()["jobs"]
        target_app = None
        for j in jobs:
            if j.get("applicant_count", 0) > 0:
                ra = requests.get(f"{BASE_URL}/api/employer/jobs/{j['id']}/applicants",
                                  headers=headers(employer_token))
                if ra.status_code == 200:
                    applicants = ra.json().get("applicants", [])
                    if applicants:
                        target_app = applicants[0]
                        break
        if not target_app:
            pytest.skip("No applicants available")

        app_id = target_app.get("id") or target_app.get("application_id")
        # invalid enum (shortlisted should be rejected)
        ri = requests.put(f"{BASE_URL}/api/employer/applications/{app_id}/status",
                          headers=headers(employer_token),
                          json={"status": "shortlisted"})
        assert ri.status_code == 400, f"expected 400, got {ri.status_code}: {ri.text}"

        # valid employer-side enums, including final employer-entered hired status
        for status in ("for_review", "for_interview", "hired", "rejected"):
            rv = requests.put(f"{BASE_URL}/api/employer/applications/{app_id}/status",
                              headers=headers(employer_token),
                              json={"status": status, "notes": f"to {status}"})
            assert rv.status_code in (200, 204), rv.text


# ---------------- Admin ----------------
class TestAdmin:
    def test_stats(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        for k in ("total_users", "total_jobs", "total_applications"):
            assert k in data, f"missing {k}: {data}"

    def test_pending_employers(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/employers/pending",
                         headers=headers(admin_token))
        assert r.status_code == 200
        assert "employers" in r.json() or isinstance(r.json(), list)

    def test_admin_jobs_and_applications(self, admin_token):
        rj = requests.get(f"{BASE_URL}/api/admin/jobs", headers=headers(admin_token))
        assert rj.status_code == 200
        ra = requests.get(f"{BASE_URL}/api/admin/applications", headers=headers(admin_token))
        assert ra.status_code == 200


# ---------------- Skills + Notifications ----------------
class TestMisc:
    def test_skills_master_list(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/skills", headers=headers(seeker_token))
        assert r.status_code == 200
        skills = r.json().get("skills", [])
        assert len(skills) >= 20  # 25 expected

    def test_notifications(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/notifications", headers=headers(seeker_token))
        assert r.status_code == 200


# ---------------- Role-based ----------------
class TestRBAC:
    def test_seeker_blocked_from_employer(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/employer/jobs", headers=headers(seeker_token))
        assert r.status_code == 403

    def test_employer_blocked_from_admin(self, employer_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers(employer_token))
        assert r.status_code == 403

    def test_seeker_blocked_from_admin(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers(seeker_token))
        assert r.status_code == 403
