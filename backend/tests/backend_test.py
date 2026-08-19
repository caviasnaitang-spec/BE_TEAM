import uuid
import base64
import pytest
import requests

BASE_URL = "http://localhost:8001"
API = f"{BASE_URL}/api"
PNG_B64 = base64.b64encode(bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c62000100000005000100000000000049454e44ae426082")).decode()

@pytest.fixture(scope="module")
def user_a():
    email = f"test_{uuid.uuid4().hex[:10]}@field.co"
    r = requests.post(f"{API}/auth/signup", json={"email": email, "password": "passtest123", "name": "A"})
    assert r.status_code == 201
    d = r.json()
    return {"email": email, "token": d["access_token"], "id": d["user"]["id"]}

@pytest.fixture(scope="module")
def user_b():
    email = f"test_{uuid.uuid4().hex[:10]}@field.co"
    r = requests.post(f"{API}/auth/signup", json={"email": email, "password": "passtest123", "name": "B"})
    assert r.status_code == 201
    d = r.json()
    return {"email": email, "token": d["access_token"], "id": d["user"]["id"]}

def h(token):
    return {"Authorization": f"Bearer {token}"}

class TestAuth:
    def test_signup_returns_token_and_user(self, user_a):
        assert user_a["token"] and user_a["id"]
    def test_signup_duplicate_email_409(self, user_a):
        r = requests.post(f"{API}/auth/signup", json={"email": user_a["email"], "password": "passtest123"})
        assert r.status_code == 409
    def test_login_success(self, user_a):
        r = requests.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "passtest123"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == user_a["email"].lower()
    def test_login_bad_password_401(self, user_a):
        r = requests.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "wrongpw"})
        assert r.status_code == 401
    def test_login_bad_email_401(self):
        r = requests.post(f"{API}/auth/login", json={"email": "nobody@nowhere.co", "password": "whatever"})
        assert r.status_code == 401
    def test_me_without_token_401(self):
        assert requests.get(f"{API}/auth/me").status_code == 401
    def test_me_malformed_token_401(self):
        assert requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    def test_me_valid_token_200(self, user_a):
        r = requests.get(f"{API}/auth/me", headers=h(user_a["token"]))
        assert r.status_code == 200
        assert r.json()["email"] == user_a["email"].lower()

class TestDistricts:
    def test_list_requires_auth(self):
        assert requests.get(f"{API}/districts").status_code == 401
    def test_returns_12_districts(self, user_a):
        r = requests.get(f"{API}/districts", headers=h(user_a["token"]))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 12
        keys = {d["key"] for d in data}
        assert "ri-bhoi" in keys and "east-khasi-hills" in keys
        for item in data:
            assert "_id" not in item
    def test_counts_reflect_owned_sites(self, user_a):
        s1 = requests.post(f"{API}/sites", headers=h(user_a["token"]),
                           json={"name": "TEST_A", "plot_number": "P1", "district": "ri-bhoi", "status": "Active"}).json()
        s2 = requests.post(f"{API}/sites", headers=h(user_a["token"]),
                           json={"name": "TEST_B", "plot_number": "P2", "district": "east-khasi-hills", "status": "Completed"}).json()
        r = requests.get(f"{API}/districts", headers=h(user_a["token"])).json()
        by_key = {d["key"]: d for d in r}
        assert by_key["ri-bhoi"]["site_count"] >= 1 and by_key["ri-bhoi"]["active_count"] >= 1
        assert by_key["east-khasi-hills"]["site_count"] >= 1
        for sid in (s1["id"], s2["id"]):
            requests.delete(f"{API}/sites/{sid}", headers=h(user_a["token"]))

class TestSites:
    def test_create_site_requires_auth(self):
        r = requests.post(f"{API}/sites", json={"name": "n", "plot_number": "p", "district": "ri-bhoi"})
        assert r.status_code == 401
    def test_create_site_invalid_district_400(self, user_a):
        r = requests.post(f"{API}/sites", headers=h(user_a["token"]),
                          json={"name": "TEST_x", "plot_number": "P1", "district": "no-such-place"})
        assert r.status_code == 400
    def test_create_site_invalid_status_400(self, user_a):
        r = requests.post(f"{API}/sites", headers=h(user_a["token"]),
                          json={"name": "TEST_x", "plot_number": "P1", "district": "ri-bhoi", "status": "Whatever"})
        assert r.status_code == 400
    def test_full_site_flow(self, user_a):
        t = h(user_a["token"])
        s1 = requests.post(f"{API}/sites", headers=t,
                           json={"name": "TEST_Tower One", "plot_number": "P-101", "district": "ri-bhoi", "location": "Umsning", "status": "Active"}).json()
        s2 = requests.post(f"{API}/sites", headers=t,
                           json={"name": "TEST_Warehouse", "plot_number": "P-202", "district": "east-khasi-hills", "location": "Shillong", "status": "Completed"}).json()
        assert s1["district"] == "ri-bhoi" and s2["district"] == "east-khasi-hills"
        r = requests.get(f"{API}/sites", headers=t)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert s1["id"] in ids and s2["id"] in ids
        for item in r.json():
            assert "_id" not in item
        r = requests.get(f"{API}/sites?district=ri-bhoi", headers=t)
        got = [x["id"] for x in r.json()]
        assert s1["id"] in got and s2["id"] not in got
        r = requests.get(f"{API}/sites?q=tower", headers=t)
        assert any(x["id"] == s1["id"] for x in r.json())
        r = requests.get(f"{API}/sites?status=Completed", headers=t)
        assert all(x["status"] == "Completed" for x in r.json())
        assert any(x["id"] == s2["id"] for x in r.json())
        r = requests.get(f"{API}/sites/{s1['id']}", headers=t)
        assert r.status_code == 200 and r.json()["name"] == "TEST_Tower One"
        assert requests.patch(f"{API}/sites/{s1['id']}", headers=t, json={"status": "FooBar"}).status_code == 400
        assert requests.patch(f"{API}/sites/{s1['id']}", headers=t, json={"district": "nope"}).status_code == 400
        r = requests.patch(f"{API}/sites/{s1['id']}", headers=t,
                           json={"status": "Completed", "location": "Umsning Block"})
        assert r.status_code == 200 and r.json()["status"] == "Completed"
        assert requests.delete(f"{API}/sites/{s1['id']}", headers=t).status_code == 204
        assert requests.get(f"{API}/sites/{s1['id']}", headers=t).status_code == 404

    def test_foreign_user_cannot_access(self, user_a, user_b):
        s = requests.post(f"{API}/sites", headers=h(user_a["token"]),
                          json={"name": "TEST_Private", "plot_number": "PX", "district": "ri-bhoi"}).json()
        assert all(x["id"] != s["id"] for x in requests.get(f"{API}/sites", headers=h(user_b["token"])).json())
        assert requests.get(f"{API}/sites/{s['id']}", headers=h(user_b["token"])).status_code == 404
        assert requests.patch(f"{API}/sites/{s['id']}", headers=h(user_b["token"]),
                              json={"status": "Completed"}).status_code == 404
        assert requests.delete(f"{API}/sites/{s['id']}", headers=h(user_b["token"])).status_code == 404

class TestVisits:
    def test_visit_lifecycle(self, user_a):
        t = h(user_a["token"])
        s = requests.post(f"{API}/sites", headers=t,
                          json={"name": "TEST_Visits", "plot_number": "PV-1", "district": "ri-bhoi"}).json()
        sid = s["id"]
        v1 = requests.post(f"{API}/sites/{sid}/visits", headers=t,
                           json={"title": "Visit 1 - Foundation", "note": "note1"}).json()
        v2 = requests.post(f"{API}/sites/{sid}/visits", headers=t, json={"note": "note2"}).json()
        v3 = requests.post(f"{API}/sites/{sid}/visits", headers=t, json={}).json()
        assert v1["sequence"] == 1 and v2["sequence"] == 2 and v3["sequence"] == 3
        assert v1["title"] == "Visit 1 - Foundation"
        r = requests.get(f"{API}/sites/{sid}/visits", headers=t)
        assert r.status_code == 200
        seqs = [v["sequence"] for v in r.json()]
        assert seqs == [1, 2, 3]
        r = requests.get(f"{API}/visits/{v1['id']}", headers=t)
        assert r.status_code == 200 and r.json()["note"] == "note1"
        r = requests.patch(f"{API}/visits/{v1['id']}", headers=t, json={"note": "updated", "progress_pct": 45})
        assert r.status_code == 200 and r.json()["note"] == "updated" and r.json()["progress_pct"] == 45
        assert requests.get(f"{API}/sites/{sid}", headers=t).json()["visit_count"] == 3
        assert requests.delete(f"{API}/visits/{v3['id']}", headers=t).status_code == 204
        assert requests.get(f"{API}/visits/{v3['id']}", headers=t).status_code == 404
        requests.delete(f"{API}/sites/{sid}", headers=t)

    def test_visits_isolated_by_owner(self, user_a, user_b):
        s = requests.post(f"{API}/sites", headers=h(user_a["token"]),
                          json={"name": "TEST_Iso", "plot_number": "PI", "district": "ri-bhoi"}).json()
        v = requests.post(f"{API}/sites/{s['id']}/visits", headers=h(user_a["token"]), json={}).json()
        assert requests.get(f"{API}/sites/{s['id']}/visits", headers=h(user_b["token"])).status_code == 404
        assert requests.post(f"{API}/sites/{s['id']}/visits", headers=h(user_b["token"]), json={}).status_code == 404
        assert requests.get(f"{API}/visits/{v['id']}", headers=h(user_b["token"])).status_code == 404
        assert requests.patch(f"{API}/visits/{v['id']}", headers=h(user_b["token"]), json={"note": "x"}).status_code == 404
        assert requests.delete(f"{API}/visits/{v['id']}", headers=h(user_b["token"])).status_code == 404

class TestPhotos:
    def test_photo_lifecycle(self, user_a, user_b):
        t = h(user_a["token"])
        s = requests.post(f"{API}/sites", headers=t,
                          json={"name": "TEST_PhotoSite", "plot_number": "PP-1", "district": "ri-bhoi"}).json()
        v = requests.post(f"{API}/sites/{s['id']}/visits", headers=t, json={}).json()
        vid = v["id"]
        r = requests.post(f"{API}/visits/{vid}/photos", headers=t,
                          json={"image_base64": f"data:image/png;base64,{PNG_B64}",
                                "latitude": 12.34, "longitude": 56.78, "accuracy": 5.0,
                                "note": "corner shot"})
        assert r.status_code == 201
        p = r.json()
        assert not p["image_base64"].startswith("data:")
        assert p["latitude"] == 12.34
        photo_id = p["id"]
        r2 = requests.post(f"{API}/visits/{vid}/photos", headers=t, json={"image_base64": PNG_B64})
        assert r2.status_code == 201
        r = requests.get(f"{API}/visits/{vid}/photos", headers=t)
        assert r.status_code == 200
        photos = r.json()
        assert len(photos) == 2
        for ph in photos:
            assert "_id" not in ph
        assert requests.get(f"{API}/visits/{vid}", headers=t).json()["photo_count"] == 2
        assert requests.get(f"{API}/sites/{s['id']}", headers=t).json()["photo_count"] == 2
        assert requests.get(f"{API}/visits/{vid}/photos", headers=h(user_b["token"])).status_code == 404
        assert requests.post(f"{API}/visits/{vid}/photos", headers=h(user_b["token"]),
                             json={"image_base64": PNG_B64}).status_code == 404
        assert requests.delete(f"{API}/photos/{photo_id}", headers=h(user_b["token"])).status_code == 404
        assert requests.delete(f"{API}/photos/{photo_id}", headers=t).status_code == 204
        assert requests.delete(f"{API}/visits/{vid}", headers=t).status_code == 204
        assert requests.get(f"{API}/visits/{vid}/photos", headers=t).status_code == 404
        s2 = requests.post(f"{API}/sites", headers=t,
                           json={"name": "TEST_Cascade", "plot_number": "P-C", "district": "ri-bhoi"}).json()
        v2 = requests.post(f"{API}/sites/{s2['id']}/visits", headers=t, json={}).json()
        requests.post(f"{API}/visits/{v2['id']}/photos", headers=t, json={"image_base64": PNG_B64})
        assert requests.delete(f"{API}/sites/{s2['id']}", headers=t).status_code == 204
        assert requests.get(f"{API}/visits/{v2['id']}", headers=t).status_code == 404
