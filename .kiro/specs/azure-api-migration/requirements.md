# Requirements Document

## Introduction

This feature involves migrating the existing grading system from its current AI implementation to use Azure OpenAI API services. The system currently uses mock implementations and needs to be updated to integrate with Azure OpenAI GPT-4o-mini for essay grading and Azure OpenAI text-embedding-ada-002 for embeddings. The migration should maintain all existing functionality while providing real AI-powered grading capabilities through Azure's API.

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want the grading system to use Azure OpenAI API services, so that the system can provide real AI-powered essay grading instead of mock responses.

#### Acceptance Criteria

1. WHEN the system initializes THEN it SHALL connect to Azure OpenAI endpoint at "https://hkust.azure-api.net"
2. WHEN the system needs to generate embeddings THEN it SHALL use Azure OpenAI text-embedding-ada-002 model
3. WHEN the system needs to grade essays THEN it SHALL use Azure OpenAI GPT-4o-mini deployment
4. WHEN making API calls THEN the system SHALL use API version "2024-10-21"
5. WHEN making API calls THEN the system SHALL use temperature 0.0 for consistent grading results

### Requirement 2

**User Story:** As a developer, I want the Azure API integration to follow the existing interface contracts, so that the migration doesn't break existing functionality.

#### Acceptance Criteria

1. WHEN implementing Azure AI client THEN it SHALL implement the existing AIClient interface
2. WHEN the Azure client generates embeddings THEN it SHALL return List[float] as expected by the interface
3. WHEN the Azure client grades essays THEN it SHALL return GradingCriterion objects as expected
4. WHEN the Azure client validates connections THEN it SHALL return boolean status as expected
5. WHEN the Azure client provides model info THEN it SHALL return dictionary with Azure-specific information

### Requirement 3

**User Story:** As a system operator, I want proper error handling and configuration management for Azure API integration, so that the system can handle API failures gracefully and be easily configured.

#### Acceptance Criteria

1. WHEN Azure API calls fail THEN the system SHALL implement retry logic with exponential backoff
2. WHEN API rate limits are exceeded THEN the system SHALL handle rate limiting gracefully
3. WHEN API keys are missing or invalid THEN the system SHALL provide clear error messages
4. WHEN configuration is loaded THEN the system SHALL validate all required Azure parameters
5. WHEN network issues occur THEN the system SHALL provide meaningful error messages to users

### Requirement 4

**User Story:** As a security-conscious administrator, I want API credentials to be managed securely, so that sensitive information is not exposed in the codebase.

#### Acceptance Criteria

1. WHEN the system starts THEN it SHALL read API keys from environment variables
2. WHEN API keys are used THEN they SHALL never be logged or exposed in error messages
3. WHEN configuration is stored THEN API keys SHALL not be stored in plain text files
4. WHEN the system validates credentials THEN it SHALL do so securely without exposing keys
5. WHEN errors occur THEN API keys SHALL be redacted from any error output

### Requirement 5

**User Story:** As a developer, I want the Azure implementation to be easily testable and maintainable, so that the system can be developed and debugged efficiently.

#### Acceptance Criteria

1. WHEN running tests THEN the system SHALL support both real Azure API and mock implementations
2. WHEN debugging THEN the system SHALL provide detailed logging for Azure API interactions
3. WHEN developing THEN the system SHALL allow switching between Azure and mock implementations
4. WHEN testing THEN the Azure client SHALL be mockable for unit tests
5. WHEN monitoring THEN the system SHALL provide metrics on Azure API usage and performance