"""
Backend regression tests for capstone scope update (Iteration 2).
Focuses on the diff: employer self-registration block, new status enum,
admin manage-employers create, deactivate/reactivate seekers, close-job soft removal,
real OCR with graceful fallback, account_status rename.
"""
import uuid
import requests
import pytest
from conftest import BASE_URL, headers


# ---------------- Health ----------------
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# ---------------- Auth changes: employer self-register blocked ----------------
class TestAuthScope:
    def test_employer_self_register_blocked(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"TEST_emp_blocked_{uuid.uuid4().hex[:6]}@test.com",
            "password": "Test@123", "role": "employer",
            "profile": {"company_name": "X"}
        })
        assert r.status_code == 400, r.text
        body = r.json()
        msg = body.get("error", "").lower()
        assert "admin" in msg, f"Error message should mention admin-created. Got: {body}"

    def test_job_seeker_self_register_works(self):
        email = f"TEST_seeker_{uuid.uuid4().hex[:8]}@test.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Test@123", "role": "job_seeker",
            "profile": {"first_name": "TEST", "last_name": "Seeker",
                        "contact_number": "09171234567"}
        })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["user"]["role"] == "job_seeker"
        # account_status replaces status
        assert (body["user"].get("account_status") or body["user"].get("status")) == "active"

    def test_logins_still_work(self, admin_token, seeker_token, employer_token):
        assert admin_token and seeker_token and employer_token


# ---------------- Admin: create employer ----------------
class TestAdminCreateEmployer:
    created_email = None
    created_employer_id = None

    def test_admin_creates_employer(self, admin_token):
        email = f"TEST_admin_emp_{uuid.uuid4().hex[:8]}@test.com"
        TestAdminCreateEmployer.created_email = email
        payload = {
            "email": email, "password": "Test@123",
            "company_name": "TEST Admin Created Corp",
            "contact_person": "Admin Made",
            "contact_number": "09170000000",
        }
        r = requests.post(f"{BASE_URL}/api/admin/employers",
                          headers=headers(admin_token), json=payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert "employer_id" in body and "user_id" in body
        TestAdminCreateEmployer.created_employer_id = body["employer_id"]

        # New employer can log in immediately (auto-approved + active)
        rl = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": email, "password": "Test@123"})
        assert rl.status_code == 200, rl.text
        u = rl.json()["user"]
        assert u["role"] == "employer"
        assert u.get("account_status") == "active"

    def test_non_admin_cannot_create_employer(self, employer_token, seeker_token):
        for tok in (employer_token, seeker_token):
            r = requests.post(f"{BASE_URL}/api/admin/employers",
                              headers=headers(tok),
                              json={"email": "x@x.com", "password": "Test@123",
                                    "company_name": "X"})
            assert r.status_code == 403, f"expected 403, got {r.status_code}"

    def test_duplicate_employer_rejected(self, admin_token):
        # use seeded admin email
        r = requests.post(f"{BASE_URL}/api/admin/employers",
                          headers=headers(admin_token),
                          json={"email": "admin@peso.gov.ph",
                                "password": "Test@123", "company_name": "Dup"})
        assert r.status_code == 409

    def test_admin_employers_list_uses_account_status(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/employers",
                         headers=headers(admin_token))
        assert r.status_code == 200, r.text
        emps = r.json().get("employers", r.json())
        assert isinstance(emps, list) and len(emps) > 0
        # First employer row must have account_status field, NOT status
        first = emps[0]
        assert "account_status" in first, f"missing account_status: {first.keys()}"


# ---------------- Admin: deactivate/reactivate job seekers ----------------
class TestDeactivateReactivate:
    seeker_id = None
    seeker_email = None

    def test_create_test_seeker_and_deactivate(self, admin_token):
        # create a fresh test seeker via register
        email = f"TEST_deact_{uuid.uuid4().hex[:8]}@test.com"
        TestDeactivateReactivate.seeker_email = email
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Test@123", "role": "job_seeker",
            "profile": {"first_name": "Deact", "last_name": "Target",
                        "contact_number": "09171110000"}
        })
        assert r.status_code == 201, r.text

        # find seeker in admin list
        rs = requests.get(f"{BASE_URL}/api/admin/job-seekers",
                          headers=headers(admin_token))
        assert rs.status_code == 200, rs.text
        seekers = rs.json().get("job_seekers", rs.json().get("seekers", rs.json()))
        assert isinstance(seekers, list)
        target = next((s for s in seekers if s.get("email") == email), None)
        assert target, f"seeker {email} not found in admin list"
        assert "account_status" in target
        TestDeactivateReactivate.seeker_id = target.get("id") or target.get("job_seeker_id")

        # deactivate
        rd = requests.put(
            f"{BASE_URL}/api/admin/job-seekers/{TestDeactivateReactivate.seeker_id}/deactivate",
            headers=headers(admin_token), json={})
        assert rd.status_code in (200, 204), rd.text

    def test_deactivated_seeker_cannot_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": TestDeactivateReactivate.seeker_email,
                                "password": "Test@123"})
        assert r.status_code == 403, f"deactivated seeker logged in: {r.status_code} {r.text}"

    def test_reactivate(self, admin_token):
        rr = requests.put(
            f"{BASE_URL}/api/admin/job-seekers/{TestDeactivateReactivate.seeker_id}/reactivate",
            headers=headers(admin_token), json={})
        assert rr.status_code in (200, 204), rr.text

        # login works again
        rl = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"email": TestDeactivateReactivate.seeker_email,
                                 "password": "Test@123"})
        assert rl.status_code == 200, rl.text
        assert rl.json()["user"].get("account_status") == "active"


# ---------------- Admin: close job (soft) ----------------
class TestCloseJob:
    job_id = None

    def test_create_and_close_job(self, employer_token, admin_token):
        # Create a job
        payload = {
            "job_title": "TEST Job To Close",
            "job_description": "to be closed",
            "job_type": "full-time", "location": "CDO",
            "salary_min": 15000, "salary_max": 20000,
            "required_skills": [],
        }
        rc = requests.post(f"{BASE_URL}/api/employer/jobs",
                           headers=headers(employer_token), json=payload)
        assert rc.status_code in (200, 201), rc.text
        b = rc.json()
        TestCloseJob.job_id = b.get("job_id") or b.get("id") or b.get("job", {}).get("id")
        assert TestCloseJob.job_id

        # Admin closes
        rcl = requests.put(f"{BASE_URL}/api/admin/jobs/{TestCloseJob.job_id}/close",
                           headers=headers(admin_token),
                           json={"reason": "Test closure"})
        assert rcl.status_code == 200, rcl.text

    def test_closed_job_excluded_from_public_listing(self, seeker_token):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=headers(seeker_token))
        assert r.status_code == 200
        jobs = r.json()["jobs"]
        ids = [j["id"] for j in jobs]
        assert TestCloseJob.job_id not in ids, "closed job leaks into public listing"
        for j in jobs:
            assert j["status"] == "active"

    def test_closed_job_record_still_exists(self, admin_token):
        # Admin listing should still include it with status=closed
        r = requests.get(f"{BASE_URL}/api/admin/jobs", headers=headers(admin_token))
        assert r.status_code == 200
        jobs = r.json()["jobs"]
        target = next((j for j in jobs if j["id"] == TestCloseJob.job_id), None)
        assert target, "closed job removed (hard delete) instead of soft-removed"
        assert target["status"] == "closed"


# ---------------- Applications new status enum ----------------
class TestApplicationStatuses:
    def test_default_status_submitted(self, seeker2_token):
        # maria.santos — seeded with a for_review app; pick any of her applications and check shape
        r = requests.get(f"{BASE_URL}/api/applications/my-applications",
                         headers=headers(seeker2_token))
        assert r.status_code == 200
        apps = r.json()["applications"]
        assert isinstance(apps, list)
        allowed = {"submitted", "pending", "for_review", "referred", "rejected", "closed"}
        for a in apps:
            assert a["application_status"] in allowed, f"unknown status: {a['application_status']}"
        # 'hired' must NOT appear
        assert not any(a["application_status"] == "hired" for a in apps)

    def test_status_update_accepts_all_six_and_rejects_hired(self, employer_token):
        rj = requests.get(f"{BASE_URL}/api/employer/jobs",
                          headers=headers(employer_token))
        jobs = rj.json()["jobs"]
        target = None
        for j in jobs:
            if j.get("applicant_count", 0) > 0:
                ra = requests.get(f"{BASE_URL}/api/employer/jobs/{j['id']}/applicants",
                                  headers=headers(employer_token))
                if ra.status_code == 200 and ra.json().get("applicants"):
                    target = ra.json()["applicants"][0]
                    break
        if not target:
            pytest.skip("No applicants to test")
        app_id = target.get("id") or target.get("application_id")

        # invalid: 'hired'
        ri = requests.put(f"{BASE_URL}/api/employer/applications/{app_id}/status",
                          headers=headers(employer_token),
                          json={"status": "hired"})
        assert ri.status_code == 400, f"hired should be rejected, got {ri.status_code}"

        # all 6 valid statuses
        for st in ["submitted", "pending", "for_review", "referred", "rejected", "closed"]:
            rv = requests.put(f"{BASE_URL}/api/employer/applications/{app_id}/status",
                              headers=headers(employer_token),
                              json={"status": st, "notes": f"to {st}"})
            assert rv.status_code in (200, 204), f"status {st} rejected: {rv.text}"


# ---------------- NSRP real OCR (with graceful failure) ----------------
class TestNSRPOCR:
    def test_upload_and_extract_unreadable_image_returns_200(self, seeker_token):
        # tiny 1x1 png — tesseract cannot extract text, should return 200 success=false
        png_b64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0"
                   "lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
        ru = requests.post(f"{BASE_URL}/api/nsrp/upload",
                           headers=headers(seeker_token),
                           json={"image_base64": png_b64})
        assert ru.status_code == 201, ru.text
        upload_id = ru.json()["upload_id"]

        # Extract — may take 10-30s on first call (lazy load tesseract)
        re_ = requests.post(f"{BASE_URL}/api/nsrp/extract",
                            headers=headers(seeker_token),
                            json={"upload_id": upload_id}, timeout=90)
        assert re_.status_code == 200, re_.text
        body = re_.json()
        # Contract verification
        assert "success" in body
        assert "extracted_data" in body
        assert "raw_text" in body
        assert "notice" in body
        # Editable scaffold has all 15 NSRP keys
        ed = body["extracted_data"]
        expected_keys = {
            "first_name", "middle_name", "last_name", "date_of_birth",
            "gender", "civil_status", "contact_number", "address",
            "city", "province", "education_level", "course",
            "years_of_experience", "employment_status", "preferred_occupation",
        }
        assert expected_keys.issubset(set(ed.keys())), f"Missing keys: {expected_keys - set(ed.keys())}"
        # Unreadable -> success false and helpful notice
        if body["success"] is False:
            assert "manual" in body["notice"].lower() or "encode" in body["notice"].lower()

    def test_confirm_is_explicit(self, seeker_token):
        # Confirm must require explicit call with confirmed_data
        r = requests.post(f"{BASE_URL}/api/nsrp/confirm",
                          headers=headers(seeker_token),
                          json={})
        assert r.status_code in (400, 422)


# ---------------- Match: no ranking ----------------
class TestMatchNoRanking:
    def test_match_returns_matched_and_unmatched_only(self, seeker_token):
        rj = requests.get(f"{BASE_URL}/api/jobs", headers=headers(seeker_token))
        job_id = rj.json()["jobs"][0]["id"]
        r = requests.get(f"{BASE_URL}/api/jobs/{job_id}/match",
                         headers=headers(seeker_token))
        assert r.status_code == 200
        data = r.json()
        assert "matched_skills" in data and "unmatched_required_skills" in data
        # explicitly: no ranking/score keys
        for forbidden in ("score", "rank", "match_percentage", "ranking"):
            assert forbidden not in data, f"forbidden ranking key '{forbidden}' present"


# ---------------- Admin stats ----------------
class TestAdminStats:
    def test_stats_shape(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("total_users", "total_jobs", "total_applications",
                  "pending_employer_approvals"):
            assert k in d, f"missing {k}: {d.keys()}"
            assert isinstance(d[k], int)
