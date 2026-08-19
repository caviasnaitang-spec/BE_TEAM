# FieldMonitor

FieldMonitor construction-site monitoring app with a FastAPI/MongoDB backend and Expo/React Native frontend.

## Structure
- `backend/` — FastAPI API, MongoDB integration, authentication, sites, visits and photos.
- `frontend/` — Expo/React Native application with offline queue/sync, GPS-tagged camera capture and site/visit management.

## Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with your MongoDB URL and JWT secret
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

## Frontend
```bash
cd frontend
npm install
```
Create `frontend/.env` with:
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001/api
```
Then run:
```bash
npm start
```

## Security
Do not commit `.env`, credentials, API keys, MongoDB credentials, or other secrets.
