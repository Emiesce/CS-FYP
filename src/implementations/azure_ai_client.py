"""
Azure OpenAI implementation of the AIClient interface.
Provides real AI-powered grading and embedding capabilities through Azure OpenAI services.
"""

import os
import json
import asyncio
import logging
import hashlib
import random
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
from langchain_core.messages import HumanMessage

try:
    from ..interfaces.ai_client import AIClient
    from ..models.grading_models import GradingCriterion
    from ..errors.grading_errors import AIServiceError
except ImportError:
    # Fallback for standalone execution
    from interfaces.ai_client import AIClient
    from models.grading_models import GradingCriterion
    from errors.grading_errors import AIServiceError

logger = logging.getLogger(__name__)


@dataclass
class AzureOpenAIConfig:
    """Configuration for Azure OpenAI integration."""
    endpoint: str = "https://hkust.azure-api.net"
    api_key: str = ""
    api_version: str = "2024-10-21"
    deployment_name: str = "gpt-4o-mini"
    embedding_deployment_name: str = "text-embedding-ada-002"
    temperature: float = 0.0
    max_retries: int = 3
    timeout: int = 30
    
    @classmethod
    def from_environment(cls) -> 'AzureOpenAIConfig':
        """Create configuration from environment variables."""
        return cls(
            api_key=os.environ.get('OPENAI_API_KEY', ''),
            endpoint=os.environ.get('AZURE_OPENAI_ENDPOINT', cls.endpoint),
            api_version=os.environ.get('AZURE_OPENAI_API_VERSION', cls.api_version),
            deployment_name=os.environ.get('AZURE_OPENAI_DEPLOYMENT', cls.deployment_name),
            embedding_deployment_name=os.environ.get('AZURE_EMBEDDING_DEPLOYMENT', cls.embedding_deployment_name)
        )
    
    def validate(self) -> None:
        """Validate configuration parameters."""
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        if len(self.api_key) < 20:
            raise ValueError("Invalid API key format")
        
        if not self.endpoint.startswith('https://'):
            raise ValueError("Azure endpoint must use HTTPS")
    
    def get_info(self) -> Dict[str, Any]:
        """Return configuration info with sensitive data redacted."""
        return {
            "endpoint": self.endpoint,
            "api_version": self.api_version,
            "deployment_name": self.deployment_name,
            "embedding_deployment_name": self.embedding_deployment_name,
            "temperature": self.temperature,
            "api_key": "***REDACTED***" if self.api_key else "NOT_SET"
        }


@dataclass
class RetryConfig:
    """Configuration for retry logic with exponential backoff."""
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True
    backoff_factor: float = 0.5  # Factor for jitter calculation


class AzureAPIError(Exception):
    """Base exception for Azure API errors."""
    
    def __init__(self, message: str, error_code: Optional[str] = None, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.error_code = error_code
        self.details = details or {}
        # Ensure no sensitive data is stored in the exception
        self._sanitize_details()
    
    def _sanitize_details(self):
        """Remove sensitive information from error details."""
        sensitive_keys = ['api_key', 'authorization', 'token', 'key', 'secret', 'password']
        for key in list(self.details.keys()):
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                self.details[key] = "***REDACTED***"


class RateLimitError(AzureAPIError):
    """Raised when API rate limits are exceeded."""
    
    def __init__(self, message: str, retry_after: Optional[int] = None, error_code: Optional[str] = None):
        super().__init__(message, error_code)
        self.retry_after = retry_after


class AuthenticationError(AzureAPIError):
    """Raised when API authentication fails."""
    
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message, error_code)


class NetworkError(AzureAPIError):
    """Raised when network issues occur."""
    
    def __init__(self, message: str, error_code: Optional[str] = None, is_timeout: bool = False):
        super().__init__(message, error_code)
        self.is_timeout = is_timeout


class QuotaExceededError(AzureAPIError):
    """Raised when API quota is exceeded."""
    
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message, error_code)


class InvalidRequestError(AzureAPIError):
    """Raised when the request is invalid."""
    
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message, error_code)


class ServiceUnavailableError(AzureAPIError):
    """Raised when the Azure service is temporarily unavailable."""
    
    def __init__(self, message: str, error_code: Optional[str] = None):
        super().__init__(message, error_code)


class AzureAIClient(AIClient):
    """Azure OpenAI implementation of the AIClient interface."""
    
    def __init__(self, config: Optional[AzureOpenAIConfig] = None):
        """
        Initialize Azure AI Client.
        
        Args:
            config: Azure OpenAI configuration. If None, loads from environment.
        """
        self.config = config or AzureOpenAIConfig.from_environment()
        self.config.validate()
        
        self.retry_config = RetryConfig()
        
        # Initialize Azure OpenAI clients
        # Use azure_deployment (new langchain-openai) with fallback to deployment_name (old)
        chat_kwargs = dict(
            azure_endpoint=self.config.endpoint,
            api_key=self.config.api_key,
            api_version=self.config.api_version,
            temperature=self.config.temperature,
        )
        embedding_kwargs = dict(
            azure_endpoint=self.config.endpoint,
            api_key=self.config.api_key,
            api_version=self.config.api_version,
        )

        try:
            self.chat_client = AzureChatOpenAI(
                **chat_kwargs,
                azure_deployment=self.config.deployment_name,
            )
        except TypeError:
            self.chat_client = AzureChatOpenAI(
                **chat_kwargs,
                deployment_name=self.config.deployment_name,
            )

        try:
            self.embedding_client = AzureOpenAIEmbeddings(
                **embedding_kwargs,
                azure_deployment=self.config.embedding_deployment_name,
            )
        except TypeError:
            self.embedding_client = AzureOpenAIEmbeddings(
                **embedding_kwargs,
                deployment_name=self.config.embedding_deployment_name,
            )
        
        logger.info(f"Initialized Azure AI Client with endpoint: {self.config.endpoint}")
    
    async def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding using Azure OpenAI text-embedding-ada-002.
        
        Args:
            text: Input text to embed
            
        Returns:
            List of float values representing the embedding vector
            
        Raises:
            AIServiceError: If embedding generation fails
        """
        try:
            # Input validation
            if not text or not text.strip():
                raise ValueError("Text cannot be empty")
            
            # Truncate text if too long (Azure has token limits)
            text = self._truncate_text(text, max_tokens=8000)
            
            logger.debug(f"Generating embedding for text of length {len(text)}")
            
            # Generate embedding with retry logic
            embedding = await self._retry_with_backoff(
                self._generate_embedding_internal,
                text
            )
            
            logger.debug(f"Generated embedding with {len(embedding)} dimensions")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to generate embedding: {e}")
            raise AIServiceError(f"Embedding generation failed: {str(e)}")
    
    async def _generate_embedding_internal(self, text: str) -> List[float]:
        """Internal method for embedding generation."""
        try:
            # Use the embedding client to generate embeddings
            embeddings = await self.embedding_client.aembed_documents([text])
            return embeddings[0]
        except Exception as e:
            raise self._classify_azure_error(e)
    
    async def grade_essay(
        self,
        essay: str,
        context: str,
        criterion_name: str,
        criterion_id: str,
        max_score: float,
        lecture_notes_context: Optional[str] = None
    ) -> GradingCriterion:
        """
        Grade essay using Azure OpenAI GPT-4o-mini with optional lecture notes context.
        
        Args:
            essay: The student's essay text
            context: Relevant rubric context from vector search
            criterion_name: Name of the criterion being evaluated
            criterion_id: Unique identifier for the criterion
            max_score: Maximum possible score for this criterion
            lecture_notes_context: Optional lecture notes context for enhanced grading
            
        Returns:
            GradingCriterion object with evaluation results
            
        Raises:
            AIServiceError: If grading operation fails
        """
        try:
            logger.debug(f"Grading essay for criterion: {criterion_name}")
            
            # Construct grading prompt with lecture notes if available
            prompt = self._build_grading_prompt(
                essay=essay,
                context=context,
                criterion_name=criterion_name,
                criterion_id=criterion_id,
                max_score=max_score,
                lecture_notes_context=lecture_notes_context
            )
            
            # Generate grading with structured output
            response = await self._retry_with_backoff(
                self._grade_essay_internal,
                prompt
            )
            
            # Parse and validate response
            grading_result = self._parse_grading_response(
                response, criterion_id, criterion_name, max_score,
                has_lecture_notes=lecture_notes_context is not None
            )
            
            logger.debug(f"Graded essay: {grading_result.score}/{grading_result.max_score}")
            return grading_result
            
        except Exception as e:
            logger.error(f"Failed to grade essay for criterion {criterion_name}: {e}")
            raise AIServiceError(f"Essay grading failed: {str(e)}")
    
    async def _grade_essay_internal(self, prompt: str) -> str:
        """Internal method for essay grading."""
        try:
            message = HumanMessage(content=prompt)
            response = await self.chat_client.ainvoke([message])
            return response.content
        except Exception as e:
            raise self._classify_azure_error(e)

    async def grade_essay_multi_criteria(
        self,
        essay: str,
        context: str,
        criteria: List[Dict[str, Any]],
        lecture_notes_context: Optional[str] = None
    ) -> List[GradingCriterion]:
        """
        Grade an essay against multiple criteria in a single AI call.
        More cost-efficient than calling grade_essay() once per criterion.

        Args:
            essay: The student's essay text
            context: Rubric context from vector search
            criteria: List of criterion dicts with keys: id, name, max_score
            lecture_notes_context: Optional lecture notes context

        Returns:
            List of GradingCriterion results, one per criterion
        """
        try:
            prompt = self._build_multi_criteria_prompt(essay, context, criteria, lecture_notes_context)
            response = await self._retry_with_backoff(self._grade_essay_internal, prompt)
            return self._parse_multi_criteria_response(response, criteria)
        except Exception as e:
            logger.error(f"Multi-criteria grading failed, falling back to per-criterion: {e}")
            # Fallback: grade each criterion individually
            results = []
            for c in criteria:
                result = await self.grade_essay(
                    essay=essay,
                    context=context,
                    criterion_name=c.get("name", ""),
                    criterion_id=c["id"],
                    max_score=c.get("max_score", 10),
                    lecture_notes_context=lecture_notes_context
                )
                results.append(result)
            return results

    def _build_multi_criteria_prompt(
        self,
        essay: str,
        context: str,
        criteria: List[Dict[str, Any]],
        lecture_notes_context: Optional[str] = None
    ) -> str:
        """Build a prompt that grades all criteria in one call."""
        criteria_list = "\n".join(
            f'{i+1}. **{c.get("name", "")}** (max {c.get("max_score", 10)} marks)\n   {c.get("rubric_text", "")}'
            for i, c in enumerate(criteria)
        )
        criteria_json_schema = ",\n    ".join(
            f'{{"criterion_id": "{c["id"]}", "criterion_name": "{c.get("name","")}", '
            f'"score": <0–{c.get("max_score",10)} in 0.5 increments>, '
            f'"max_score": {c.get("max_score",10)}, '
            f'"justification": "<explanation>", '
            f'"suggestion_for_improvement": "<feedback>", '
            f'"highlighted_text": "<excerpt>"}}'
            for c in criteria
        )

        lecture_section = ""
        if lecture_notes_context and lecture_notes_context.strip():
            lecture_section = f"\n**RELEVANT LECTURE CONTENT:**\n{lecture_notes_context}\n"

        return f"""You are an expert AI teaching assistant grading a student's answer against a rubric.

**STUDENT ANSWER:**
{essay}

**RUBRIC CRITERIA TO GRADE:**
{criteria_list}
{lecture_section}
**RUBRIC CONTEXT:**
{context}

**GRADING INSTRUCTIONS:**
1. Read the student's answer carefully
2. Grade the answer against EACH criterion listed above independently
3. For each criterion, assign a score in 0.5 increments only (e.g. 7.0, 7.5, 8.0 — not 7.3)
4. Provide specific justification and improvement suggestion for each criterion
5. Quote relevant text from the student's answer as highlighted_text

**RESPONSE FORMAT:**
Respond with a valid JSON array — one object per criterion, in the same order as listed above:
[
    {criteria_json_schema}
]

Respond only with the JSON array, no additional text."""

    def _parse_multi_criteria_response(
        self,
        response: str,
        criteria: List[Dict[str, Any]]
    ) -> List[GradingCriterion]:
        """Parse the multi-criteria JSON array response."""
        try:
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.startswith('```'):
                response = response[3:]
            if response.endswith('```'):
                response = response[:-3]
            response = response.strip()

            data = json.loads(response)
            if not isinstance(data, list):
                raise ValueError("Expected a JSON array")

            results = []
            for i, item in enumerate(data):
                # Match by position if criterion_id is missing/wrong
                c = criteria[i] if i < len(criteria) else criteria[-1]
                score = float(item.get('score', 0))
                max_score = c.get('max_score', 10)
                score = max(0.0, min(score, max_score))
                score = round(score * 2) / 2  # enforce 0.5 increments

                results.append(GradingCriterion(
                    criterion_id=c['id'],
                    criterion_name=c.get('name', ''),
                    matched_level=self._score_to_level(score, max_score),
                    score=score,
                    max_score=max_score,
                    justification=item.get('justification', ''),
                    suggestion_for_improvement=item.get('suggestion_for_improvement', ''),
                    highlighted_text=item.get('highlighted_text', ''),
                    context_metadata={"has_rubric_context": True}
                ))
            return results

        except Exception as e:
            logger.error(f"Failed to parse multi-criteria response: {e}\nResponse: {response}")
            raise AIServiceError(f"Failed to parse multi-criteria grading response: {e}")
    
    def _build_grading_prompt(
        self, 
        essay: str, 
        context: str, 
        criterion_name: str, 
        criterion_id: str, 
        max_score: float,
        lecture_notes_context: Optional[str] = None
    ) -> str:
        """Build the grading prompt for Azure OpenAI with optional lecture notes."""
        
        # Use enhanced prompt if lecture notes are available
        if lecture_notes_context and lecture_notes_context.strip():
            return f"""You are an expert AI teaching assistant. Your task is to grade a student's answer based on the provided rubric context and relevant lecture materials.

**STUDENT ANSWER:**
{essay}

**RUBRIC CRITERIA:**
{context}

**RELEVANT LECTURE CONTENT:**
{lecture_notes_context}

**GRADING INSTRUCTIONS:**
1. Carefully read the student's answer
2. Review the rubric criteria for the criterion: **{criterion_name}**
3. Consider the relevant lecture content to understand expected knowledge and concepts
4. Evaluate how well the student demonstrates understanding of course concepts
5. Assign a score between 0 and {max_score} in increments of 0.5 only (e.g. 7.0, 7.5, 8.0 — not 7.3 or 8.2)
6. Provide detailed justification that references specific lecture concepts when relevant
7. Offer constructive suggestions that guide toward better integration of course materials
8. If you reference specific lecture content, note which materials you're citing
9. Identify specific text excerpts that support your evaluation

**RESPONSE FORMAT:**
You must respond with a valid JSON object matching this exact schema:
{{
  "criterion_id": "{criterion_id}",
  "criterion_name": "{criterion_name}",
  "score": <number between 0 and {max_score} in 0.5 increments>,
  "max_score": {max_score},
  "justification": "<detailed explanation with lecture references if applicable>",
  "suggestion_for_improvement": "<constructive feedback incorporating course materials>",
  "highlighted_text": "<relevant answer excerpts>",
  "lecture_notes_references": ["<list of lecture concepts or materials referenced>"]
}}

Respond only with the JSON object, no additional text."""
        
        # Standard prompt without lecture notes
        return f"""You are an expert AI teaching assistant. Your task is to grade a student's essay based on the provided rubric context.

**STUDENT ESSAY:**
{essay}

**RUBRIC CONTEXT:**
{context}

**GRADING INSTRUCTIONS:**
1. Carefully read the student's answer
2. Review the provided rubric context
3. Evaluate the essay specifically for the criterion: **{criterion_name}**
4. Assign a score between 0 and {max_score} in increments of 0.5 only (e.g. 7.0, 7.5, 8.0 — not 7.3 or 8.2)
5. Provide detailed justification and constructive suggestions
6. Identify specific text excerpts that support your evaluation

**RESPONSE FORMAT:**
You must respond with a valid JSON object matching this exact schema:
{{
  "criterion_id": "{criterion_id}",
  "criterion_name": "{criterion_name}",
  "score": <number between 0 and {max_score} in 0.5 increments>,
  "max_score": {max_score},
  "justification": "<detailed explanation>",
  "suggestion_for_improvement": "<constructive feedback>",
  "highlighted_text": "<relevant essay excerpts>"
}}

Respond only with the JSON object, no additional text."""
    
    def _parse_grading_response(
        self, 
        response: str, 
        criterion_id: str, 
        criterion_name: str, 
        max_score: float,
        has_lecture_notes: bool = False
    ) -> GradingCriterion:
        """Parse and validate grading response from Azure OpenAI."""
        try:
            # Clean response - remove any markdown formatting
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.endswith('```'):
                response = response[:-3]
            response = response.strip()
            
            # Parse JSON
            data = json.loads(response)
            
            # Validate required fields
            required_fields = ['score', 'justification', 'suggestion_for_improvement']
            for field in required_fields:
                if field not in data:
                    raise ValueError(f"Missing required field: {field}")
            
            # Validate score and round to nearest 0.5
            score = float(data['score'])
            if score < 0 or score > max_score:
                logger.warning(f"Score {score} out of range, clamping to [0, {max_score}]")
                score = max(0.0, min(score, max_score))
            # Round to nearest 0.5 (e.g. 8.3 → 8.5, 8.2 → 8.0)
            score = round(score * 2) / 2
            
            # Extract lecture notes references if available
            lecture_notes_refs = data.get('lecture_notes_references', None)
            
            # Build context metadata
            context_metadata = {
                "has_rubric_context": True,
                "has_lecture_notes": has_lecture_notes,
                "lecture_notes_referenced": lecture_notes_refs is not None and len(lecture_notes_refs) > 0 if lecture_notes_refs else False
            }
            
            # Create GradingCriterion object
            return GradingCriterion(
                criterion_id=criterion_id,
                criterion_name=criterion_name,
                matched_level=self._score_to_level(score, max_score),
                score=score,
                max_score=max_score,
                justification=data['justification'],
                suggestion_for_improvement=data['suggestion_for_improvement'],
                highlighted_text=data.get('highlighted_text', ''),
                lecture_notes_references=lecture_notes_refs,
                context_metadata=context_metadata
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON response: {e}")
            logger.error(f"Response was: {response}")
            raise AIServiceError(f"Invalid JSON response from Azure OpenAI: {e}")
        except Exception as e:
            logger.error(f"Failed to parse grading response: {e}")
            raise AIServiceError(f"Failed to parse grading response: {e}")
    
    def _score_to_level(self, score: float, max_score: float) -> str:
        """Convert numerical score to performance level."""
        percentage = (score / max_score) * 100 if max_score > 0 else 0
        
        if percentage >= 90:
            return "Excellent"
        elif percentage >= 80:
            return "Good"
        elif percentage >= 70:
            return "Satisfactory"
        elif percentage >= 60:
            return "Needs Improvement"
        else:
            return "Unsatisfactory"
    
    async def validate_connection(self) -> bool:
        """
        Validate Azure OpenAI connection.
        
        Returns:
            True if connection is valid, False otherwise
        """
        try:
            logger.debug("Validating Azure OpenAI connection...")
            
            # Test embedding generation
            test_embedding = await self.generate_embedding("test connection")
            
            # Test chat completion
            test_message = HumanMessage(content="Hello, this is a connection test. Please respond with 'OK'.")
            test_response = await self.chat_client.ainvoke([test_message])
            
            is_valid = len(test_embedding) > 0 and test_response is not None
            
            if is_valid:
                logger.info("Azure OpenAI connection validated successfully")
            else:
                logger.warning("Azure OpenAI connection validation failed")
            
            return is_valid
            
        except Exception as e:
            logger.warning(f"Azure OpenAI connection validation failed: {e}")
            return False
    
    async def get_model_info(self) -> dict:
        """
        Get Azure OpenAI model information.
        
        Returns:
            Dictionary containing model information
        """
        return {
            "model_name": self.config.deployment_name,
            "embedding_model": self.config.embedding_deployment_name,
            "endpoint": self.config.endpoint,
            "api_version": self.config.api_version,
            "temperature": self.config.temperature,
            "capabilities": ["text_generation", "embeddings", "structured_output"],
            "provider": "Azure OpenAI",
            "configuration": self.config.get_info()
        }
    
    def _truncate_text(self, text: str, max_tokens: int = 8000) -> str:
        """
        Truncate text to approximate token limit.
        Uses rough estimation of 4 characters per token.
        """
        max_chars = max_tokens * 4
        if len(text) <= max_chars:
            return text
        
        logger.warning(f"Truncating text from {len(text)} to {max_chars} characters")
        return text[:max_chars]
    
    async def _retry_with_backoff(self, func, *args, **kwargs):
        """Implement exponential backoff retry logic."""
        last_exception = None
        
        for attempt in range(self.retry_config.max_retries + 1):
            try:
                return await func(*args, **kwargs)
                
            except RateLimitError as e:
                if attempt == self.retry_config.max_retries:
                    raise e
                
                # Use retry-after header if available
                delay = getattr(e, 'retry_after', None) or self._calculate_delay(attempt)
                logger.warning(f"Rate limited, retrying in {delay}s (attempt {attempt + 1})")
                await asyncio.sleep(delay)
                last_exception = e
                
            except (NetworkError, asyncio.TimeoutError) as e:
                if attempt == self.retry_config.max_retries:
                    raise e
                
                delay = self._calculate_delay(attempt)
                logger.warning(f"Network error, retrying in {delay}s (attempt {attempt + 1})")
                await asyncio.sleep(delay)
                last_exception = e
                
            except AuthenticationError as e:
                # Don't retry auth errors
                raise e
                
            except Exception as e:
                if attempt == self.retry_config.max_retries:
                    raise e
                
                delay = self._calculate_delay(attempt)
                logger.warning(f"Unexpected error, retrying in {delay}s (attempt {attempt + 1}): {e}")
                await asyncio.sleep(delay)
                last_exception = e
        
        raise last_exception
    
    def _calculate_delay(self, attempt: int) -> float:
        """Calculate delay for exponential backoff."""
        delay = self.retry_config.base_delay * (self.retry_config.exponential_base ** attempt)
        delay = min(delay, self.retry_config.max_delay)
        
        if self.retry_config.jitter:
            delay *= (0.5 + random.random() * 0.5)  # Add jitter
        
        return delay
    
    def _classify_azure_error(self, error: Exception) -> AzureAPIError:
        """
        Classify Azure API errors for appropriate handling.
        
        Args:
            error: The original exception from Azure API
            
        Returns:
            Classified AzureAPIError subclass
        """
        error_message = str(error).lower()
        error_type = type(error).__name__
        
        # Extract error code if available
        error_code = self._extract_error_code(str(error))
        
        # Sanitize error message to remove sensitive information
        sanitized_message = self._sanitize_error_message(str(error))
        
        # Rate limiting errors
        if any(indicator in error_message for indicator in [
            "rate limit", "429", "too many requests", "quota exceeded"
        ]):
            retry_after = self._extract_retry_after(str(error))
            if "quota" in error_message:
                return QuotaExceededError(sanitized_message, error_code)
            return RateLimitError(sanitized_message, retry_after, error_code)
        
        # Authentication errors
        elif any(indicator in error_message for indicator in [
            "unauthorized", "401", "invalid api key", "authentication failed",
            "access denied", "forbidden", "403"
        ]):
            return AuthenticationError(sanitized_message, error_code)
        
        # Network and timeout errors
        elif any(indicator in error_message for indicator in [
            "timeout", "connection", "network", "502", "503", "504",
            "bad gateway", "service unavailable", "gateway timeout"
        ]):
            is_timeout = "timeout" in error_message
            if any(indicator in error_message for indicator in ["502", "503", "504", "service unavailable"]):
                return ServiceUnavailableError(sanitized_message, error_code)
            return NetworkError(sanitized_message, error_code, is_timeout)
        
        # Invalid request errors
        elif any(indicator in error_message for indicator in [
            "400", "bad request", "invalid request", "malformed",
            "invalid parameter", "validation error"
        ]):
            return InvalidRequestError(sanitized_message, error_code)
        
        # Generic Azure API error
        else:
            logger.warning(f"Unclassified Azure API error type: {error_type}")
            return AzureAPIError(sanitized_message, error_code, {"original_type": error_type})
    
    def _extract_error_code(self, error_message: str) -> Optional[str]:
        """Extract error code from Azure API error message."""
        # Look for common error code patterns
        patterns = [
            r'error[_\s]*code[:\s]*([A-Za-z0-9_]+)',
            r'code[:\s]*([A-Za-z0-9_]+)',
            r'([A-Za-z]+Error)',
            r'HTTP\s*(\d{3})'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, error_message, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_retry_after(self, error_message: str) -> Optional[int]:
        """Extract retry-after value from error message."""
        patterns = [
            r'retry[_\s]*after[:\s]*(\d+)',
            r'try[_\s]*again[_\s]*in[:\s]*(\d+)',
            r'wait[_\s]*(\d+)[_\s]*seconds?'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, error_message, re.IGNORECASE)
            if match:
                return int(match.group(1))
        
        return None
    
    def _sanitize_error_message(self, message: str) -> str:
        """
        Remove sensitive information from error messages.
        
        Args:
            message: Original error message
            
        Returns:
            Sanitized error message with sensitive data redacted
        """
        # Patterns for sensitive data
        sensitive_patterns = [
            (r'api[_\s]*key[:\s]*[A-Za-z0-9\-_]{10,}', 'api_key: ***REDACTED***'),
            (r'authorization[:\s]*bearer\s+[A-Za-z0-9\-_\.]{10,}', 'authorization: Bearer ***REDACTED***'),
            (r'token[:\s]*[A-Za-z0-9\-_\.]{10,}', 'token: ***REDACTED***'),
            (r'secret[:\s]*[A-Za-z0-9\-_]{10,}', 'secret: ***REDACTED***'),
            (r'password[:\s]*[A-Za-z0-9\-_]{6,}', 'password: ***REDACTED***'),
            # Redact potential API keys in URLs
            (r'https?://[^/]*\?[^&]*key=[A-Za-z0-9\-_]{10,}', 'URL with redacted key'),
        ]
        
        sanitized = message
        for pattern, replacement in sensitive_patterns:
            sanitized = re.sub(pattern, replacement, sanitized, flags=re.IGNORECASE)
        
        return sanitized