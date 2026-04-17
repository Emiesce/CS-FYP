# CS-FYP

To run the full project, you must have two terminals active, one running the frontend and the other running the backend:

Frontend
```bash
cd /CS-FYP/exam-platform
npm install        # first time only
npm run dev
# → http://localhost:3000
```

Backend
```bash
cd /CS-FYP/exam-platform/backend
python3 -m venv .venv                    # first time only
source .venv/bin/activate                # every time
pip install -r requirements.txt          # first time only
python3 -m uvicorn app.main:app --reload
# → http://localhost:8000
```