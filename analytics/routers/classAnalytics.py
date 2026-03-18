from fastapi import APIRouter, Depends
from services.db import DB, get_db_connection
from services.class_analytics_services import compute_exam_score_distribution, compute_question_results
from services.ai_services import AIService
from pydantic import BaseModel
from typing import List, Dict, Literal

router = APIRouter()
ai_service = AIService()

class ChatMessage(BaseModel):
    role: Literal[ "user", "system", "assistant" ]
    content: str

class ChatRequest(BaseModel):
    exam_id: str
    messages: List[ChatMessage]

@router.get("/exam/{exam_id}/statistics")
def get_exam_statistics(
    exam_id: str,
    db: DB = Depends(get_db_connection)
):

    stats = compute_exam_score_distribution(db, exam_id)

    if not stats:
        return {"message": "No data found"}

    return stats

@router.get("/exam/{exam_id}/questionsStatistics")
def get_exam_questionsStatistics(
    exam_id: str,
    db: DB = Depends(get_db_connection)
):

    stats = compute_question_results(db, exam_id)

    if not stats:
        return {"message": "No data found"}

    return stats

@router.get("/exam/{exam_id}/questionsAnalysis")
def get_questionsAnalysis(exam_id: str, db: DB = Depends(get_db_connection)):
    analysis = ai_service.full_exam_analysis(db, exam_id)
    return analysis["questions"]

@router.get("/exam/{exam_id}/topics")
def get_topics(exam_id: str, db: DB = Depends(get_db_connection)):
    analysis = ai_service.full_exam_analysis(db, exam_id)
    return analysis["topics"]

@router.get("/exam/{exam_id}/summary")
def get_summary(exam_id: str, db: DB = Depends(get_db_connection)):
    analysis = ai_service.full_exam_analysis(db, exam_id)
    return analysis["examSummary"]

@router.post("/chat")
def chat(request: ChatRequest, db: DB = Depends(get_db_connection)):

    if not request.messages:
        return {"error": "No messages provided"}

    # Take latest user message
    last_message: ChatMessage = request.messages[-1]
    user_message = last_message.content

    response_text = ai_service.chat_about_exam(
        db=db,
        exam_id=request.exam_id,
        user_message=user_message
    )

    return {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": response_text
                }
            }
        ]
    }