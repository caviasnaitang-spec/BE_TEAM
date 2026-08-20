import os
import uuid
import logging
import base64
import asyncio
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Annotated, List, Optional

import bcrypt
import boto3
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "10080"))
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()

# ---------- Cloudflare R2 ----------
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "").strip()
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "").strip()
R2_ENDPOINT = os.getenv("R2_ENDPOINT", "").strip()
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "").strip()

if not all([
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_ENDPOINT,
    R2_BUCKET_NAME,
]):
    raise RuntimeError(
        "R2 configuration missing: "
        "R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, "
        "R2_ENDPOINT, R2_BUCKET_NAME"
    )

r2_client = boto3.client(
    "s3",
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    region_name="auto",
)


client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="FieldMonitor API")
api_router = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ---------- Districts ----------
DISTRICTS: List[dict] = [
    {"key": "east-jaintia-hills", "name": "East Jaintia Hills"},
    {"key": "east-khasi-hills", "name": "East Khasi Hills"},
    {"key": "east-garo-hills", "name": "East Garo Hills"},
    {"key": "eastern-west-khasi-hills", "name": "Eastern West Khasi Hills"},
    {"key": "north-garo-hills", "name": "North Garo Hills"},
    {"key": "ri-bhoi", "name": "Ri Bhoi"},
    {"key": "south-garo-hills", "name": "South Garo Hills"},
    {"key": "south-west-garo-hills", "name": "South West Garo Hills"},
    {"key": "south-west-khasi-hills", "name": "South West Khasi Hills"},
    {"key": "west-garo-hills", "name": "West Garo Hills"},
    {"key": "west-jaintia-hills", "name": "West Jaintia Hills"},
    {"key": "west-khasi-hills", "name": "West Khasi Hills"},
]
DISTRICT_KEYS = {d["key"] for d in DISTRICTS}

# ---------- Seed Sites (84) ----------
SEED_SITES: List[dict] = (
    [{"name": n, "district": "east-garo-hills", "location": ""} for n in [
        "Nanitha G Momin", "Kerallina Marak", "Jartina N Marak",
        "Sengchi T Sangma", "Chitro Marak",
    ]]
    + [{"name": n, "district": "east-khasi-hills", "location": ""} for n in [
        "Albidora", "Landris", "Wanshan", "Wanphrang", "Raynoldbert Warjri",
    ]]
    + [{"name": n, "district": "east-jaintia-hills", "location": ""} for n in [
        "Nimon Chyrmang", "Amnesty Salahe", "Sooki Sukhlain", "Army Phawa",
        "Diemonme Salahe", "Midros Ryngkhlem",
    ]]
    + [{"name": n, "district": "north-garo-hills", "location": ""} for n in [
        "Sunitha Marak", "Benazir Momin", "Monica Sangma", "Tapashree Hadu",
        "Manoah Ch Marak", "Mallingson M Sangma",
    ]]
    + [{"name": n, "district": "ri-bhoi", "location": ""} for n in [
        "Divia Rapsang", "Espar Kharraji", "Mary Anne Hynniewta",
        "Phidalin Khymdeit", "Preciously Shadap", "Victoria Sohphoh",
        "Wosslingshon Wahlang",
    ]]
    + [{"name": n, "district": "south-west-garo-hills", "location": ""} for n in [
        "Balsrang B Marak", "Kalsin G Momin", "Simrey Ch Momin",
        "Pronami Hajong", "Prosati Koch",
    ]]
    + [{"name": n, "district": "south-west-khasi-hills", "location": ""} for n in [
        "Chegan Dalbot Shira", "Phromwel Thongni", "Peter Syiemlieh",
        "Iktiar M Dkhar", "Rapborlang Thongni", "Strondar Syiemlieh",
        "Singerland Snaitang", "Banikorlin Kharlyngdoh",
    ]]
    + [{"name": n, "district": "west-garo-hills", "location": ""} for n in [
        "Silarin M Sangma", "Chemitha A Sangma", "Veronica A Sangma",
    ]]
    + [{"name": n, "district": "west-jaintia-hills", "location": ""} for n in [
        "Armingroi Dkhar", "Lambiang Ryngkhlem", "Wikin Phawa",
        "Larikynti Marboh", "Solimai Talang", "Lasubon Phawa",
        "Helpme Laloo", "Kamniki Syngkon", "Silverius Susngi",
        "Nida Arki Pale", "Iakheinduh Dkhar", "Ninnydaroi Lywait",
        "Ram Kynjiñ", "Mustbe Sdor", "Prisnika Synnah",
    ]]
    + [{"name": "Sitamary Lyngdoh Mawnai", "district": "west-khasi-hills", "location": ""}]
    + [{"name": n, "district": "eastern-west-khasi-hills", "location": "Mairang"} for n in [
        "Aiphidalin Wahlang", "BANSHANLANG NONGWAR", "Batika Nongrang",
        "Dralina Pariong", "Istarwell Khyllait", "Kelding Lyngdoh Nonglait",
        "Martina Ryntathiang", "Romila War", "Rose A Kharsyntiew",
        "Tiewlarisha Dkhar", "Tngenlang Wahlang", "Wanshida Nongsiej",
    ]]
    + [{"name": n, "district": "west-khasi-hills", "location": "Nongstoin"} for n in [
        "Ibanrihunlang Khardewsaw", "Banairihunlang Ryntathiang",
        "Darsing Syiemlieh", "Mishalta Lyngkhoi", "Bibiblish",
        "Bandarity Syiem", "William Lawren", "Sunita Lyngdoh", "Lashanbor",
    ]]
    + [{"name": n, "district": "south-west-khasi-hills", "location": ""} for n in [
        "Paleihun", "Armstrong",
    ]]
)

# ---------- Pydantic Models ----------
class SignupBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = None

class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class PublicUser(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    status: str = "approved"
    is_admin: bool = False

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: PublicUser
    status: str = "approved"

class AdminUser(BaseModel):
    id: str
    email: EmailStr
    name: Optional[str] = None
    status: str
    is_admin: bool = False
    created_at: str

class DistrictWithCount(BaseModel):
    key: str
    name: str
    site_count: int
    active_count: int
    completed_count: int

class SiteCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    plot_number: str = Field(min_length=1, max_length=100)
    district: str = Field(min_length=1)
    location: Optional[str] = ""
    status: str = Field(default="Active")

class SiteUpdate(BaseModel):
    name: Optional[str] = None
    plot_number: Optional[str] = None
    district: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None

class Site(BaseModel):
    id: str
    name: str
    plot_number: str
    district: str
    location: str
    status: str
    owner_id: str
    visit_count: int = 0
    photo_count: int = 0
    created_at: str
    updated_at: str

class VisitCreate(BaseModel):
    title: Optional[str] = None
    note: Optional[str] = ""

class VisitUpdate(BaseModel):
    title: Optional[str] = None
    note: Optional[str] = None
    progress_pct: Optional[int] = None
    issues: Optional[str] = None
    recommendations: Optional[str] = None

class Visit(BaseModel):
    id: str
    site_id: str
    owner_id: str
    sequence: int
    title: str
    note: str
    progress_pct: Optional[int] = None
    issues: str = ""
    recommendations: str = ""
    photo_count: int = 0
    created_at: str
    updated_at: str

class PhotoCreate(BaseModel):
    image_base64: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    captured_at: Optional[str] = None
    note: Optional[str] = ""

class Photo(BaseModel):
    id: str
    site_id: str
    visit_id: str
    image_base64: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    captured_at: str
    note: str = ""
    created_at: str

# ---------- Helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(password: str, encoded: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), encoded.encode("utf-8"))
    except (ValueError, TypeError):
        return False

def issue_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "iat": now, "exp": now + timedelta(minutes=TOKEN_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def normalize_email(email: str) -> str:
    return email.strip().lower()

def user_public(doc: dict) -> PublicUser:
    email = normalize_email(doc["email"])
    return PublicUser(
        id=doc["id"],
        email=email,
        name=doc.get("name"),
        status=doc.get("status", "approved"),
        is_admin=bool(ADMIN_EMAIL and email == ADMIN_EMAIL),
    )

def site_public(doc: dict, visit_count: int = 0, photo_count: int = 0) -> Site:
    return Site(
        id=doc["id"],
        name=doc["name"],
        plot_number=doc["plot_number"],
        district=doc.get("district", ""),
        location=doc.get("location", ""),
        status=doc.get("status", "Active"),
        owner_id=doc["owner_id"],
        visit_count=visit_count,
        photo_count=photo_count,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )

def visit_public(doc: dict, photo_count: int = 0) -> Visit:
    return Visit(
        id=doc["id"],
        site_id=doc["site_id"],
        owner_id=doc["owner_id"],
        sequence=doc["sequence"],
        title=doc.get("title", f"Visit {doc['sequence']}"),
        note=doc.get("note", ""),
        progress_pct=doc.get("progress_pct"),
        issues=doc.get("issues", ""),
        recommendations=doc.get("recommendations", ""),
        photo_count=photo_count,
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )

async def current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    err = HTTPException(
        status_code=401,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise err
    except jwt.InvalidTokenError:
        raise err
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise err
    if user.get("status", "approved") != "approved":
        raise HTTPException(status_code=403, detail="Account is not approved")
    return user

async def _photo_counts_by_site(site_ids: List[str]) -> dict:
    counts = {}
    if not site_ids:
        return counts
    pipeline = [
        {"$match": {"site_id": {"$in": site_ids}}},
        {"$group": {"_id": "$site_id", "count": {"$sum": 1}}},
    ]
    async for row in db.photos.aggregate(pipeline):
        counts[row["_id"]] = row["count"]
    return counts

async def _visit_counts_by_site(site_ids: List[str]) -> dict:
    counts = {}
    if not site_ids:
        return counts
    pipeline = [
        {"$match": {"site_id": {"$in": site_ids}}},
        {"$group": {"_id": "$site_id", "count": {"$sum": 1}}},
    ]
    async for row in db.visits.aggregate(pipeline):
        counts[row["_id"]] = row["count"]
    return counts

async def _seed_sites_for_user(user_id: str) -> int:
    # Sites are shared across the FieldMonitor team.
    # Only seed the database when no sites exist yet.
    if await db.sites.count_documents({}) > 0:
        return 0
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for i, s in enumerate(SEED_SITES, start=1):
        docs.append({
            "id": str(uuid.uuid4()),
            "name": s["name"],
            "plot_number": f"S-{i:03d}",
            "district": s["district"],
            "location": s.get("location", ""),
            "status": "Active",
            "owner_id": user_id,
            "created_at": now,
            "updated_at": now,
        })
    if docs:
        await db.sites.insert_many(docs)
    return len(docs)

# ---------- Auth ----------
@api_router.post("/auth/signup", response_model=AuthResponse, status_code=201)
async def signup(body: SignupBody):
    email = normalize_email(str(body.email))
    if await db.users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="Email is already registered")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": user_id,
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "status": "pending",
        "created_at": now,
    }
    await db.users.insert_one(doc)
    return AuthResponse(
        access_token="",
        user=user_public(doc),
        status="pending",
    )

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(body: LoginBody):
    email = normalize_email(str(body.email))
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    account_status = user.get("status", "approved")

    if account_status == "pending":
        raise HTTPException(
            status_code=403,
            detail="Your account is awaiting administrator approval",
        )

    if account_status == "rejected":
        raise HTTPException(
            status_code=403,
            detail="Your account registration was rejected",
        )

    return AuthResponse(
        access_token=issue_token(user["id"]),
        user=user_public(user),
        status="approved",
    )

@api_router.get("/auth/me", response_model=PublicUser)
async def me(user=Depends(current_user)):
    return user_public(user)

# ---------- Administration ----------

async def require_admin(user=Depends(current_user)):
    if not ADMIN_EMAIL:
        raise HTTPException(
            status_code=503,
            detail="ADMIN_EMAIL is not configured on the server",
        )
    if normalize_email(user["email"]) != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user

@api_router.get("/admin/users", response_model=List[AdminUser])
async def admin_users(user=Depends(require_admin)):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return [
        AdminUser(
            id=d["id"],
            email=d["email"],
            name=d.get("name"),
            status=d.get("status", "approved"),
            is_admin=normalize_email(d["email"]) == ADMIN_EMAIL,
            created_at=d["created_at"],
        )
        for d in docs
    ]

@api_router.patch("/admin/users/{user_id}/approve")
async def admin_approve_user(user_id: str, user=Depends(require_admin)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "approved"}}
    )

    try:
        await _seed_sites_for_user(user_id)
    except Exception as e:
        logging.warning("seed failed for approved user %s: %s", user_id, e)

    return {"message": "User approved"}

@api_router.patch("/admin/users/{user_id}/reject")
async def admin_reject_user(user_id: str, user=Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="You cannot reject your own account")

    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"status": "rejected"}}
    )

    return {"message": "User rejected"}

# ---------- Seed ----------
@api_router.post("/seed/meghalaya")
async def seed_meghalaya(user=Depends(current_user)):
    inserted = await _seed_sites_for_user(user["id"])
    return {"inserted": inserted, "total": await db.sites.count_documents({})}

# ---------- Districts ----------
@api_router.get("/districts", response_model=List[DistrictWithCount])
async def list_districts(user=Depends(current_user)):
    pipeline = [
        {"$match": {}},
        {
            "$group": {
                "_id": "$district",
                "site_count": {"$sum": 1},
                "active_count": {"$sum": {"$cond": [{"$eq": ["$status", "Active"]}, 1, 0]}},
                "completed_count": {"$sum": {"$cond": [{"$eq": ["$status", "Completed"]}, 1, 0]}},
            }
        },
    ]
    counts_by_key = {}
    async for row in db.sites.aggregate(pipeline):
        counts_by_key[row["_id"]] = {
            "site_count": row["site_count"],
            "active_count": row["active_count"],
            "completed_count": row["completed_count"],
        }
    return [
        DistrictWithCount(
            key=d["key"],
            name=d["name"],
            site_count=counts_by_key.get(d["key"], {}).get("site_count", 0),
            active_count=counts_by_key.get(d["key"], {}).get("active_count", 0),
            completed_count=counts_by_key.get(d["key"], {}).get("completed_count", 0),
        )
        for d in DISTRICTS
    ]

# ---------- Sites ----------
@api_router.post("/sites", response_model=Site, status_code=201)
async def create_site(body: SiteCreate, user=Depends(current_user)):
    if body.status not in ("Active", "Completed"):
        raise HTTPException(status_code=400, detail="Invalid status")
    if body.district not in DISTRICT_KEYS:
        raise HTTPException(status_code=400, detail="Invalid district")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "plot_number": body.plot_number.strip(),
        "district": body.district,
        "location": (body.location or "").strip(),
        "status": body.status,
        "owner_id": user["id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.sites.insert_one(doc)
    return site_public(doc, 0, 0)

@api_router.get("/sites", response_model=List[Site])
async def list_sites(
    user=Depends(current_user),
    q: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    district: Optional[str] = Query(default=None),
):
    query = {}
    if status_filter in ("Active", "Completed"):
        query["status"] = status_filter
    if district:
        if district not in DISTRICT_KEYS:
            raise HTTPException(status_code=400, detail="Invalid district")
        query["district"] = district
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"plot_number": {"$regex": q, "$options": "i"}},
            {"location": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.sites.find(query, {"_id": 0}).sort("updated_at", -1).to_list(500)
    site_ids = [d["id"] for d in docs]
    photos = await _photo_counts_by_site(site_ids)
    visits = await _visit_counts_by_site(site_ids)
    return [site_public(d, visits.get(d["id"], 0), photos.get(d["id"], 0)) for d in docs]

@api_router.get("/sites/{site_id}", response_model=Site)
async def get_site(site_id: str, user=Depends(current_user)):
    doc = await db.sites.find_one({"id": site_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Site not found")
    v = await db.visits.count_documents({"site_id": site_id})
    p = await db.photos.count_documents({"site_id": site_id})
    return site_public(doc, v, p)

@api_router.patch("/sites/{site_id}", response_model=Site)
async def update_site(site_id: str, body: SiteUpdate, user=Depends(current_user)):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name.strip()
    if body.plot_number is not None:
        updates["plot_number"] = body.plot_number.strip()
    if body.district is not None:
        if body.district not in DISTRICT_KEYS:
            raise HTTPException(status_code=400, detail="Invalid district")
        updates["district"] = body.district
    if body.location is not None:
        updates["location"] = body.location.strip()
    if body.status is not None:
        if body.status not in ("Active", "Completed"):
            raise HTTPException(status_code=400, detail="Invalid status")
        updates["status"] = body.status
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.sites.update_one(
        {"id": site_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Site not found")
    doc = await db.sites.find_one({"id": site_id}, {"_id": 0})
    v = await db.visits.count_documents({"site_id": site_id})
    p = await db.photos.count_documents({"site_id": site_id})
    return site_public(doc, v, p)

@api_router.delete("/sites/{site_id}", status_code=204)
async def delete_site(site_id: str, user=Depends(current_user)):
    result = await db.sites.delete_one({"id": site_id, "owner_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Site not found")
    await db.visits.delete_many({"site_id": site_id})
    await db.photos.delete_many({"site_id": site_id})
    return None

# ---------- Visits ----------
@api_router.get("/sites/{site_id}/visits", response_model=List[Visit])
async def list_visits(site_id: str, user=Depends(current_user)):
    site = await db.sites.find_one({"id": site_id}, {"_id": 1})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    docs = await db.visits.find({"site_id": site_id}, {"_id": 0}).sort("sequence", 1).to_list(500)
    photo_counts = {}
    if docs:
        pipeline = [
            {"$match": {"visit_id": {"$in": [d["id"] for d in docs]}}},
            {"$group": {"_id": "$visit_id", "count": {"$sum": 1}}},
        ]
        async for row in db.photos.aggregate(pipeline):
            photo_counts[row["_id"]] = row["count"]
    return [visit_public(d, photo_counts.get(d["id"], 0)) for d in docs]

@api_router.post("/sites/{site_id}/visits", response_model=Visit, status_code=201)
async def create_visit(site_id: str, body: VisitCreate, user=Depends(current_user)):
    site = await db.sites.find_one({"id": site_id}, {"_id": 1})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    existing = await db.visits.count_documents({"site_id": site_id})
    sequence = existing + 1
    now = datetime.now(timezone.utc).isoformat()
    title = (body.title or f"Visit {sequence}").strip()
    doc = {
        "id": str(uuid.uuid4()),
        "site_id": site_id,
        "owner_id": user["id"],
        "sequence": sequence,
        "title": title,
        "note": (body.note or "").strip(),
        "created_at": now,
        "updated_at": now,
    }
    await db.visits.insert_one(doc)
    await db.sites.update_one({"id": site_id}, {"$set": {"updated_at": now}})
    return visit_public(doc, 0)

@api_router.get("/visits/{visit_id}", response_model=Visit)
async def get_visit(visit_id: str, user=Depends(current_user)):
    doc = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Visit not found")
    pc = await db.photos.count_documents({"visit_id": visit_id})
    return visit_public(doc, pc)

@api_router.patch("/visits/{visit_id}", response_model=Visit)
async def update_visit(visit_id: str, body: VisitUpdate, user=Depends(current_user)):
    updates = {}
    if body.title is not None:
        updates["title"] = body.title.strip() or "Visit"
    if body.note is not None:
        updates["note"] = body.note.strip()
    if body.progress_pct is not None:
        p = max(0, min(100, int(body.progress_pct)))
        updates["progress_pct"] = p
    if body.issues is not None:
        updates["issues"] = body.issues.strip()
    if body.recommendations is not None:
        updates["recommendations"] = body.recommendations.strip()
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.visits.update_one(
        {"id": visit_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Visit not found")
    doc = await db.visits.find_one({"id": visit_id}, {"_id": 0})
    pc = await db.photos.count_documents({"visit_id": visit_id})
    return visit_public(doc, pc)

@api_router.delete("/visits/{visit_id}", status_code=204)
async def delete_visit(visit_id: str, user=Depends(current_user)):
    visit = await db.visits.find_one_and_delete({"id": visit_id, "owner_id": user["id"]})
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    await db.photos.delete_many({"visit_id": visit_id})
    return None

# ---------- Photos ----------
@api_router.post("/visits/{visit_id}/photos", response_model=Photo, status_code=201)
async def add_photo(visit_id: str, body: PhotoCreate, user=Depends(current_user)):
    visit = await db.visits.find_one(
        {"id": visit_id, "owner_id": user["id"]},
        {"_id": 0},
    )

    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    now = datetime.now(timezone.utc).isoformat()

    b64 = body.image_base64

    if b64.startswith("data:"):
        comma = b64.find(",")
        if comma != -1:
            b64 = b64[comma + 1:]

    try:
        image_bytes = base64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid image data",
        )

    max_size = 15 * 1024 * 1024

    if len(image_bytes) > max_size:
        raise HTTPException(
            status_code=413,
            detail="Image is too large. Maximum size is 15 MB.",
        )

    photo_id = str(uuid.uuid4())
    object_key = f"visits/{visit_id}/{photo_id}.jpg"

    try:
        await asyncio.to_thread(
            r2_client.put_object,
            Bucket=R2_BUCKET_NAME,
            Key=object_key,
            Body=image_bytes,
            ContentType="image/jpeg",
        )
    except Exception as exc:
        logger.exception("R2 upload failed")
        raise HTTPException(
            status_code=502,
            detail="Photo upload failed",
        ) from exc

    doc = {
        "id": photo_id,
        "site_id": visit["site_id"],
        "visit_id": visit_id,
        "r2_key": object_key,
        "latitude": body.latitude,
        "longitude": body.longitude,
        "accuracy": body.accuracy,
        "captured_at": body.captured_at or now,
        "note": (body.note or "").strip(),
        "created_at": now,
    }

    try:
        await db.photos.insert_one(doc)
    except Exception as exc:
        try:
            await asyncio.to_thread(
                r2_client.delete_object,
                Bucket=R2_BUCKET_NAME,
                Key=object_key,
            )
        except Exception:
            logger.exception("Failed to clean up R2 object")

        raise HTTPException(
            status_code=500,
            detail="Could not save photo record",
        ) from exc

    await db.visits.update_one(
        {"id": visit_id},
        {"$set": {"updated_at": now}},
    )

    await db.sites.update_one(
        {"id": visit["site_id"]},
        {"$set": {"updated_at": now}},
    )

    response_doc = {
        **doc,
        "image_base64": "data:image/jpeg;base64," + b64,
    }

    return Photo(**response_doc)


@api_router.get("/visits/{visit_id}/photos", response_model=List[Photo])
async def list_photos(visit_id: str, user=Depends(current_user)):
    visit = await db.visits.find_one(
        {"id": visit_id},
        {"_id": 1},
    )

    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    docs = await db.photos.find(
        {"visit_id": visit_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(1000)

    result = []

    for doc in docs:
        if doc.get("r2_key"):
            try:
                def download_r2():
                    obj = r2_client.get_object(
                        Bucket=R2_BUCKET_NAME,
                        Key=doc["r2_key"],
                    )
                    return obj["Body"].read()

                image_bytes = await asyncio.to_thread(download_r2)

                encoded = base64.b64encode(
                    image_bytes
                ).decode("utf-8")

                doc["image_base64"] = (
                    "data:image/jpeg;base64," + encoded
                )

            except Exception:
                logger.exception(
                    "Failed to read photo from R2: %s",
                    doc.get("r2_key"),
                )
                continue

        # Keep compatibility with old MongoDB photos.
        if doc.get("image_base64"):
            result.append(Photo(**doc))

    return result


@api_router.delete("/photos/{photo_id}", status_code=204)
async def delete_photo(photo_id: str, user=Depends(current_user)):
    photo = await db.photos.find_one(
        {"id": photo_id},
        {"_id": 0},
    )

    if not photo:
        raise HTTPException(
            status_code=404,
            detail="Photo not found",
        )

    site = await db.sites.find_one(
        {
            "id": photo["site_id"],
            "owner_id": user["id"],
        },
        {"_id": 1},
    )

    if not site:
        raise HTTPException(
            status_code=404,
            detail="Photo not found",
        )

    if photo.get("r2_key"):
        try:
            await asyncio.to_thread(
                r2_client.delete_object,
                Bucket=R2_BUCKET_NAME,
                Key=photo["r2_key"],
            )
        except Exception as exc:
            logger.exception("R2 delete failed")
            raise HTTPException(
                status_code=502,
                detail="Could not delete photo from storage",
            ) from exc

    await db.photos.delete_one({"id": photo_id})

    return None


@api_router.get("/")
async def root():
    return {"service": "FieldMonitor API", "status": "ok"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.sites.create_index("owner_id")
    await db.sites.create_index([("owner_id", 1), ("district", 1)])
    await db.visits.create_index("site_id")
    await db.visits.create_index("owner_id")
    await db.photos.create_index("site_id")
    await db.photos.create_index("visit_id")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
