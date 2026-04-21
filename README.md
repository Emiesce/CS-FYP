# CS-FYP Exam Platform

This project runs as three pieces:

- PostgreSQL in Docker
- FastAPI backend on `http://127.0.0.1:8000`
- Next.js frontend on `http://127.0.0.1:3000`

## Startup

### 1. Start PostgreSQL

From `exam-platform/`:

```bash
docker compose up -d
```

This starts:

- PostgreSQL on host port `5433`
- Adminer on `http://localhost:8080`

Adminer connection settings:

- System: `PostgreSQL`
- Server: `db`
- Username: `examuser`
- Password: `examsecret`
- Database: `exam_platform`

### 2. Start the backend

From `exam-platform/backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m alembic upgrade head
PYTHONPATH=. python3 scripts/seed.py
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Notes:

- `PYTHONPATH=. python3 scripts/seed.py` resets the application tables and repopulates the initial demo dataset.
- The seed now also loads the `MGMT2110` essay dataset from `exam-platform/mgmtAns.json` as submitted attempts in PostgreSQL.

### 3. Start the frontend

From `exam-platform/`:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3000`.

## Demo accounts

The login page fetches the seeded demo accounts from the backend. The main accounts are:

- Student: `student@ust.hk` / `student123`
- Instructor: `instructor@ust.hk` / `instructor123`
- Teaching Assistant: `ta@ust.hk` / `ta123`
- Administrator: `admin@ust.hk` / `admin123`

## Reset the database to the initial seed

### Fast reset

If PostgreSQL is already running and you just want to wipe the app data back to the initial seed:

```bash
cd exam-platform/backend
source .venv/bin/activate
python3 -m alembic upgrade head
PYTHONPATH=. python3 scripts/seed.py
```

This clears the seeded application tables and reloads:

- demo users
- courses and exams
- MGMT2110 submitted answer dataset
- proctoring/grading-related seed state cleanup

### Full reset

If you want to destroy the PostgreSQL volume as well:

```bash
cd exam-platform
docker compose down -v
docker compose up -d
cd backend
source .venv/bin/activate
python3 -m alembic upgrade head
PYTHONPATH=. python3 scripts/seed.py
```

## MGMT2110 seeded dataset

On every reseed, the backend imports `exam-platform/mgmtAns.json` and creates real submitted attempts for the seeded `MGMT2110` exam. This is useful for:

- grading pipeline testing
- analytics snapshots
- staff-side review/demo flows

The imported answers are stored as normal exam attempts and question responses in PostgreSQL, so staff APIs can read them without depending on the JSON file at runtime.