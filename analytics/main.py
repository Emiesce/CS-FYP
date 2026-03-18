from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import classAnalytics

app = FastAPI(title="AI Analytics Module")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(classAnalytics.router, prefix="/api")
#app.include_router(studentAnalytics.router, prefix="/api")
#app.include_router(examSummary.router, prefix="/api")
#app.include_router(questionAnalytics.router, prefix="/api")
