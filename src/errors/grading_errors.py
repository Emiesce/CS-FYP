"""
Error types and exception classes for RAG essay grading system.
Provides structured error handling with specific error categories.
"""

from typing import Optional, Dict, Any
from ..models.grading_models import GradingErrorType


class GradingException(Exception):
    """Base exception class for all grading-related errors."""
    
    def __init__(
        self, 
        message: str, 
        error_type: GradingErrorType,
        details: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_type = error_type
        self.details = details
        self.context = context or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary format."""
        return {
            "type": self.error_type.value,
            "message": self.message,
            "details": self.details,
            "context": self.context
        }


class RubricParsingError(GradingException):
    """Exception raised when rubric parsing fails."""
    
    def __init__(self, message: str, details: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_type=GradingErrorType.RUBRIC_PARSING_ERROR,
            details=details,
            context=context
        )


class AIServiceError(GradingException):
    """Exception raised when AI service operations fail."""
    
    def __init__(self, message: str, details: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_type=GradingErrorType.AI_SERVICE_ERROR,
            details=details,
            context=context
        )


class VectorStoreError(GradingException):
    """Exception raised when vector store operations fail."""
    
    def __init__(self, message: str, details: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_type=GradingErrorType.VECTOR_STORE_ERROR,
            details=details,
            context=context
        )


class IntegrationError(GradingException):
    """Exception raised when system integration fails."""
    
    def __init__(self, message: str, details: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_type=GradingErrorType.INTEGRATION_ERROR,
            details=details,
            context=context
        )


class ValidationError(GradingException):
    """Exception raised when input validation fails."""
    
    def __init__(self, message: str, details: Optional[str] = None, context: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            error_type=GradingErrorType.VALIDATION_ERROR,
            details=details,
            context=context
        )


# Error handling utilities
class ErrorHandler:
    """Utility class for consistent error handling across the system."""
    
    @staticmethod
    def handle_ai_service_error(original_error: Exception, operation: str) -> AIServiceError:
        """Convert generic AI service errors to structured AIServiceError."""
        return AIServiceError(
            message=f"AI service operation '{operation}' failed",
            details=str(original_error),
            context={"operation": operation, "original_error_type": type(original_error).__name__}
        )
    
    @staticmethod
    def handle_vector_store_error(original_error: Exception, operation: str) -> VectorStoreError:
        """Convert generic vector store errors to structured VectorStoreError."""
        return VectorStoreError(
            message=f"Vector store operation '{operation}' failed",
            details=str(original_error),
            context={"operation": operation, "original_error_type": type(original_error).__name__}
        )
    
    @staticmethod
    def handle_validation_error(field: str, value: Any, reason: str) -> ValidationError:
        """Create structured validation error."""
        return ValidationError(
            message=f"Validation failed for field '{field}'",
            details=reason,
            context={"field": field, "value": str(value)}
        )
    
    @staticmethod
    def handle_integration_error(component: str, operation: str, original_error: Exception) -> IntegrationError:
        """Convert integration errors to structured IntegrationError."""
        return IntegrationError(
            message=f"Integration with '{component}' failed during '{operation}'",
            details=str(original_error),
            context={
                "component": component,
                "operation": operation,
                "original_error_type": type(original_error).__name__
            }
        )