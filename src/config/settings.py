"""
Configuration settings for RAG essay grading system.
Centralizes all system configuration and constants.
"""

import os
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class AIClientConfig:
    """Configuration for Azure OpenAI AI client services."""
    
    # Azure OpenAI API configuration
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = "https://hkust.azure-api.net"
    azure_openai_api_version: str = "2024-10-21"
    azure_openai_deployment: str = "gpt-4o-mini"
    azure_embedding_deployment: str = "text-embedding-ada-002"
    temperature: float = 0.0
    
    # Request configuration
    max_retries: int = 3
    timeout_seconds: int = 30
    rate_limit_requests_per_minute: int = 60
    
    @classmethod
    def from_environment(cls) -> 'AIClientConfig':
        """Create configuration from environment variables."""
        return cls(
            azure_openai_api_key=os.environ.get('OPENAI_API_KEY', ''),
            azure_openai_endpoint=os.environ.get('AZURE_OPENAI_ENDPOINT', cls.azure_openai_endpoint),
            azure_openai_api_version=os.environ.get('AZURE_OPENAI_API_VERSION', cls.azure_openai_api_version),
            azure_openai_deployment=os.environ.get('AZURE_OPENAI_DEPLOYMENT', cls.azure_openai_deployment),
            azure_embedding_deployment=os.environ.get('AZURE_EMBEDDING_DEPLOYMENT', cls.azure_embedding_deployment)
        )


@dataclass
class VectorStoreConfig:
    """Configuration for vector store operations."""
    
    # Text splitting configuration
    chunk_size: int = 1000
    chunk_overlap: int = 100
    separators: List[str] = None
    
    # Search configuration
    default_search_k: int = 3
    max_search_k: int = 10
    similarity_threshold: float = 0.7
    
    # Storage configuration
    max_documents: int = 10000
    embedding_dimension: int = 1536  # Azure text-embedding-ada-002 dimension
    
    def __post_init__(self):
        if self.separators is None:
            self.separators = ["\n\n", "\n", " ", ""]


@dataclass
class GradingServiceConfig:
    """Configuration for grading service operations."""
    
    # Performance configuration
    max_response_time_seconds: float = 2.0
    max_concurrent_requests: int = 10
    batch_size: int = 5
    
    # Grading configuration
    default_confidence_threshold: float = 0.8
    enable_text_highlighting: bool = True
    enable_improvement_suggestions: bool = True
    
    # Integration configuration
    api_base_url: str = "http://localhost:8080"
    api_timeout_seconds: int = 30


@dataclass
class SystemConfig:
    """Main system configuration combining all subsystem configs."""
    
    # Environment configuration
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"
    
    # Database configuration (if needed for persistence)
    database_url: str = "sqlite:///grading.db"
    
    # Component configurations
    ai_client: AIClientConfig = None
    vector_store: VectorStoreConfig = None
    grading_service: GradingServiceConfig = None
    
    def __post_init__(self):
        if self.ai_client is None:
            self.ai_client = AIClientConfig.from_environment()
        if self.vector_store is None:
            self.vector_store = VectorStoreConfig()
        if self.grading_service is None:
            self.grading_service = GradingServiceConfig()
        
        # Override from environment variables
        self.environment = os.environ.get('ENVIRONMENT', self.environment)
        self.debug = os.environ.get('DEBUG', str(self.debug)).lower() == 'true'
        self.log_level = os.environ.get('LOG_LEVEL', self.log_level)
        self.database_url = os.environ.get('DATABASE_URL', self.database_url)


# Global configuration instance
config = SystemConfig()


# Grading prompt templates
class PromptTemplates:
    """Collection of prompt templates for AI grading."""
    
    GRADING_TEMPLATE = """
    You are an expert AI teaching assistant. Your task is to grade a student's essay based *only* on the provided rubric context.
    Your entire evaluation must be grounded in the rubric.

    **STUDENT ESSAY:**
    {essay}

    **RUBRIC CONTEXT (Use this to grade):**
    {context}

    **GRADING INSTRUCTIONS:**
    1. Carefully read the student's essay.
    2. Review the provided rubric context.
    3. Evaluate the essay *specifically* for the criterion: **{criterion_name}**.
    4. Determine which performance level descriptor from the rubric best matches the essay's quality.
    5. Assign a fair score within that level's mark range (0 to {max_score}).
    6. Provide a detailed justification and a constructive suggestion.
    7. Format your entire response as a JSON object that matches the required schema.

    {format_instructions}
    """
    
    GRADING_WITH_LECTURE_NOTES_TEMPLATE = """
    You are an expert AI teaching assistant. Your task is to grade a student's answer based on the provided rubric context and relevant lecture materials.
    Your evaluation must be grounded in both the rubric criteria and the course content from lecture notes.

    **STUDENT ANSWER:**
    {essay}

    **RUBRIC CRITERIA:**
    {rubric_context}

    **RELEVANT LECTURE CONTENT:**
    {lecture_notes_context}

    **GRADING INSTRUCTIONS:**
    1. Carefully read the student's answer.
    2. Review the rubric criteria for the specific criterion: **{criterion_name}**.
    3. Consider the relevant lecture content to understand the expected knowledge and concepts.
    4. Evaluate how well the student demonstrates understanding of course concepts from the lecture materials.
    5. Determine which performance level from the rubric best matches the answer's quality.
    6. Assign a fair score within that level's mark range (0 to {max_score}).
    7. Provide detailed justification that references specific lecture concepts when relevant.
    8. Offer constructive suggestions that guide the student toward better integration of course materials.
    9. If you reference specific lecture content in your feedback, note which lecture materials you're citing.
    10. Format your entire response as a JSON object that matches the required schema.

    {format_instructions}
    """
    
    CONTEXT_QUERY_TEMPLATE = "How to grade '{criterion_name}' criterion"
    
    IMPROVEMENT_SUGGESTION_TEMPLATE = """
    Based on the essay evaluation, provide specific, actionable suggestions for improvement in the {criterion_name} criterion.
    Focus on concrete steps the student can take to enhance their performance.
    """


# Default rubric for testing and development
DEFAULT_TEST_RUBRIC = """
**Argument & Thesis (Max 10 points)**
- Excellent (9-10 pts): Thesis is clear, insightful, and arguable. All points in the essay directly support it.
- Good (7-8 pts): Thesis is clear but may be simplistic. Most points support the thesis.
- Needs Improvement (4-6 pts): Thesis is unclear or not arguable. Support is inconsistent.
- Inadequate (0-3 pts): No clear thesis or argument.

**Use of Evidence (Max 5 points)**
- Excellent (5 pts): Evidence is specific, well-chosen, and integrated smoothly with strong analysis.
- Good (3-4 pts): Evidence is relevant but may lack deep analysis or smooth integration.
- Needs Improvement (1-2 pts): Evidence is used but is weak, irrelevant, or poorly explained.

**Structure & Clarity (Max 5 points)**
- Excellent (5 pts): Essay is logically organized with clear topic sentences and smooth transitions.
- Good (3-4 pts): Organization is generally clear, but some sections may be confusing or poorly connected.
- Needs Improvement (1-2 pts): Essay lacks clear structure, making it difficult to follow.
"""

DEFAULT_TEST_CRITERIA = [
    {"name": "Argument & Thesis", "max_score": 10, "id": "arg_thesis"},
    {"name": "Use of Evidence", "max_score": 5, "id": "evidence"},
    {"name": "Structure & Clarity", "max_score": 5, "id": "structure"},
]