import os
import pytest
import requests

BASE_URL = os.getenv("PESO_LINK_BASE_URL", "http://localhost:8001")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


def _login(email, password, role):
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": password, "role": role}, timeout=20)
    assert r.status_code == 200, f"Login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token():
    return _login("admin@peso.gov.ph", "Admin@123", "admin")


@pytest.fixture(scope="session")
def seeker_token():
    return _login("juan.cruz@example.com", "Test@123", "job_seeker")


@pytest.fixture(scope="session")
def seeker2_token():
    return _login("maria.santos@example.com", "Test@123", "job_seeker")


@pytest.fixture(scope="session")
def employer_token():
    return _login("hr@techcorp.ph", "Test@123", "employer")


@pytest.fixture(scope="session")
def pending_employer_token():
    return _login("hr@bluemountain.ph", "Test@123", "employer")


def headers(token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
