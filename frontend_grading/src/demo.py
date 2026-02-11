"""
Demo script for RAG essay grading system.
Shows how to use the system with mock implementations.
"""

import asyncio
import json
from typing import Dict, Any

from .grading_system import RAGGradingSystem, create_test_system, get_system_info
from .models.grading_models import EssayGradingRequest
from .config.settings import DEFAULT_TEST_RUBRIC, DEFAULT_TEST_CRITERIA


async def demo_grading_system():
    """Demonstrate the RAG grading system functionality."""
    
    print("=" * 60)
    print("RAG ESSAY GRADING SYSTEM DEMO")
    print("=" * 60)
    
    # Display system information
    system_info = get_system_info()
    print(f"\nSystem: {system_info['name']} v{system_info['version']}")
    print(f"Description: {system_info['description']}")
    print(f"Components: {', '.join(system_info['components'])}")
    
    # Create test system
    print("\n1. Initializing test system...")
    system = await create_test_system()
    
    # Check system status
    status = await system.get_system_status()
    print(f"   System initialized: {status['initialized']}")
    print(f"   AI Client connected: {status['components']['ai_client']['connected']}")
    print(f"   Vector Store healthy: {status['components']['vector_store']['healthy']}")
    
    # Create and load marking scheme
    print("\n2. Creating marking scheme...")
    marking_scheme = await system.create_and_load_marking_scheme(
        question_id="q1",
        rubric_text=DEFAULT_TEST_RUBRIC,
        criteria=DEFAULT_TEST_CRITERIA,
        created_by="demo_user"
    )
    print(f"   Created marking scheme: {marking_scheme.id}")
    print(f"   Criteria count: {len(marking_scheme.criteria)}")
    
    # Test essay
    test_essay = """
    The main point of this essay is that renewable energy is important for our future. 
    Solar and wind power are key solutions to climate change because they do not produce 
    greenhouse gases like fossil fuels do. For example, a solar panel generates electricity 
    from the sun without any emissions. This is much better than coal, which is a fossil fuel 
    that releases carbon dioxide when burned.
    
    While the initial cost of setting up a wind farm is high, the long-term benefits for 
    the planet are significant. Wind turbines can generate clean electricity for decades 
    once installed. Therefore, we should invest more in these technologies to combat climate change.
    
    The structure of our energy grid must adapt to accommodate renewable sources, but this 
    challenge is surmountable with proper planning and investment. In conclusion, renewable 
    energy represents our best hope for a sustainable future.
    """
    
    # Grade the essay
    print("\n3. Grading test essay...")
    grading_request = EssayGradingRequest(
        student_id="student_123",
        essay_text=test_essay,
        marking_scheme_id=marking_scheme.id
    )
    
    grading_response = await system.grade_essay(grading_request)
    
    # Display results
    print(f"\n4. Grading Results for Student {grading_response.student_id}")
    print("=" * 50)
    
    percentage = (grading_response.total_score / grading_response.max_total_score * 100) if grading_response.max_total_score > 0 else 0
    print(f"Overall Grade: {grading_response.total_score}/{grading_response.max_total_score} ({percentage:.1f}%)")
    print(f"Overall Feedback: {grading_response.overall_feedback}")
    print(f"Processed At: {grading_response.processed_at}")
    
    print("\nDetailed Breakdown:")
    print("-" * 30)
    
    for result in grading_response.results:
        print(f"\nCriterion: {result.criterion_name}")
        print(f"Score: {result.score}/{result.max_score}")
        print(f"Level: {result.matched_level}")
        print(f"Confidence: {result.confidence:.2f}")
        print(f"Justification: {result.justification}")
        print(f"Suggestion: {result.suggestion_for_improvement}")
        if result.highlighted_text:
            print(f"Highlighted Text: \"{result.highlighted_text[:100]}...\"")
    
    # Test single criterion grading
    print("\n5. Testing single criterion grading...")
    single_result = await system.grade_single_criterion(
        essay=test_essay,
        criterion_id="arg_thesis",
        marking_scheme_id=marking_scheme.id
    )
    
    print(f"Single Criterion Result:")
    print(f"   {single_result.criterion_name}: {single_result.score}/{single_result.max_score}")
    print(f"   Level: {single_result.matched_level}")
    
    # Final system status
    print("\n6. Final system status...")
    final_status = await system.get_system_status()
    vector_count = final_status['components']['vector_store'].get('document_count', 0)
    print(f"   Documents in vector store: {vector_count}")
    
    print("\n" + "=" * 60)
    print("DEMO COMPLETED SUCCESSFULLY")
    print("=" * 60)


def format_json_output(data: Dict[str, Any]) -> str:
    """Format dictionary as pretty JSON string."""
    return json.dumps(data, indent=2, default=str)


async def demo_api_integration():
    """Demonstrate how the system would integrate with API endpoints."""
    
    print("\n" + "=" * 60)
    print("API INTEGRATION DEMO")
    print("=" * 60)
    
    system = await create_test_system()
    
    # Simulate API request/response cycle
    print("\n1. Simulating API request for essay grading...")
    
    api_request = {
        "student_id": "20841234",
        "essay_text": "Climate change is a serious issue that requires immediate action...",
        "marking_scheme_id": "scheme_123",
        "criteria_ids": ["arg_thesis", "evidence"]
    }
    
    print("Request payload:")
    print(format_json_output(api_request))
    
    # This would be handled by actual API endpoint
    print("\n2. Processing request...")
    
    # Create marking scheme first
    marking_scheme = await system.create_and_load_marking_scheme(
        question_id="q1",
        rubric_text=DEFAULT_TEST_RUBRIC,
        criteria=DEFAULT_TEST_CRITERIA,
        created_by="api_user"
    )
    
    # Update request with actual scheme ID
    api_request["marking_scheme_id"] = marking_scheme.id
    
    # Grade essay
    request = EssayGradingRequest(**api_request)
    response = await system.grade_essay(request)
    
    # Format API response
    api_response = {
        "success": True,
        "data": {
            "student_id": response.student_id,
            "total_score": response.total_score,
            "max_total_score": response.max_total_score,
            "percentage": round((response.total_score / response.max_total_score * 100), 1),
            "results": [
                {
                    "criterion_id": r.criterion_id,
                    "criterion_name": r.criterion_name,
                    "score": r.score,
                    "max_score": r.max_score,
                    "level": r.matched_level,
                    "justification": r.justification,
                    "suggestion": r.suggestion_for_improvement,
                    "confidence": r.confidence
                }
                for r in response.results
            ],
            "overall_feedback": response.overall_feedback,
            "processed_at": response.processed_at.isoformat()
        }
    }
    
    print("\n3. API Response:")
    print(format_json_output(api_response))
    
    print("\n" + "=" * 60)
    print("API INTEGRATION DEMO COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    # Run the demos
    asyncio.run(demo_grading_system())
    asyncio.run(demo_api_integration())