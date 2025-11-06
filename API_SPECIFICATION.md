# AI Grader API Specification

## Base URL
```
https://api.aigrader.com/v1
```

## Authentication
All API requests require authentication via Bearer token:
```
Authorization: Bearer <your-api-token>
```

## Common Headers
```
Content-Type: application/json
Accept: application/json
```

---

## Data Models

### Student
```json
{
  "id": "string",
  "studentNumber": "string",
  "name": "string", 
  "essay": "string",
  "rubrics": [RubricCriteria]
}
```

### RubricCriteria
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "score": "number",
  "maxScore": "number", 
  "aiSuggestedScore": "number",
  "highlightedText": "string?", // optional
  "aiJustification": "string?", // optional - AI's reasoning for the score
  "aiSuggestion": "string?" // optional - AI's improvement suggestion
}
```

### MarkingScheme
```json
{
  "id": "string",
  "questionId": "string",
  "questionType": "string", // "essay", "multiple_choice", "short_answer"
  "criteria": [GradingCriterion],
  "rawText": "string", // original rubric text
  "createdBy": "string",
  "createdAt": "string" // ISO 8601 datetime
}
```

### GradingCriterion
```json
{
  "id": "string",
  "name": "string", // e.g., "Content", "Organization"
  "description": "string",
  "maxScore": "number",
  "weight": "number?" // optional, default 1.0
}
```

### AIGradingResult
```json
{
  "criterionId": "string",
  "criterionName": "string",
  "score": "number",
  "maxScore": "number",
  "justification": "string",
  "suggestionForImprovement": "string",
  "highlightedText": "string?", // optional
  "confidence": "number" // 0-1 confidence level
}
```

### ApiResponse<T>
```json
{
  "data": "T",
  "success": "boolean",
  "message": "string?" // optional
}
```

### PaginatedResponse<T>
```json
{
  "data": "T[]",
  "total": "number",
  "page": "number", 
  "limit": "number"
}
```

---

## Endpoints

### 1. Get Students

**GET** `/students`

Retrieve all students for a specific course and exam.

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| courseId | string | No | Filter by course ID |
| examId | string | No | Filter by exam ID |

#### Example Request
```bash
curl -X GET "https://api.aigrader.com/v1/students?courseId=CS101&examId=essay1" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

#### Example Response
```json
{
  "data": [
    {
      "id": "1",
      "studentNumber": "2084 1234",
      "name": "John Smith",
      "essay": "Several factors contribute to the planning fallacy...",
      "rubrics": [
        {
          "id": "content1",
          "title": "Content 1: Explain the concept of planning fallacy",
          "description": "AI: The student answer elaborated on the idea of planning fallacy causes",
          "score": 8,
          "maxScore": 10,
          "aiSuggestedScore": 7,
          "highlightedText": "complexity of tasks can obscure the true time and cost"
        }
      ]
    }
  ],
  "success": true,
  "message": "Students retrieved successfully"
}
```

#### Response Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `500` - Internal Server Error

---

### 2. Get Students (Paginated)

**GET** `/students/paginated`

Retrieve students with pagination support.

#### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| limit | number | No | 10 | Items per page |
| courseId | string | No | - | Filter by course ID |

#### Example Request
```bash
curl -X GET "https://api.aigrader.com/v1/students/paginated?page=1&limit=5&courseId=CS101" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

#### Example Response
```json
{
  "data": [
    {
      "id": "1",
      "studentNumber": "2084 1234",
      "name": "John Smith",
      "essay": "Several factors contribute to the planning fallacy...",
      "rubrics": [...]
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 5
}
```

#### Response Codes
- `200` - Success
- `400` - Bad Request (invalid page/limit)
- `401` - Unauthorized

---

### 3. Get Student by ID

**GET** `/students/{studentId}`

Retrieve a specific student by their ID.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentId | string | Yes | Student ID |

#### Example Request
```bash
curl -X GET "https://api.aigrader.com/v1/students/1" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

#### Example Response
```json
{
  "data": {
    "id": "1",
    "studentNumber": "2084 1234",
    "name": "John Smith",
    "essay": "Several factors contribute to the planning fallacy...",
    "rubrics": [...]
  },
  "success": true,
  "message": "Student found"
}
```

#### Response Codes
- `200` - Success
- `404` - Student not found
- `401` - Unauthorized

---

### 4. Update Rubric Score

**PUT** `/students/{studentId}/rubrics/{rubricId}`

Update the score for a specific rubric of a student.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentId | string | Yes | Student ID |
| rubricId | string | Yes | Rubric ID |

#### Request Body
```json
{
  "score": 8
}
```

#### Example Request
```bash
curl -X PUT "https://api.aigrader.com/v1/students/1/rubrics/content1" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"score": 8}'
```

#### Example Response
```json
{
  "data": true,
  "success": true,
  "message": "Score updated successfully"
}
```

#### Validation Rules
- Score must be between 0 and maxScore
- Score will be automatically clamped to valid range

#### Response Codes
- `200` - Success
- `400` - Bad Request (invalid score)
- `404` - Student or rubric not found
- `401` - Unauthorized

---

### 5. Save Student Grades

**POST** `/students/{studentId}/grades`

Save all current grades for a student.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentId | string | Yes | Student ID |

#### Request Body
```json
{
  "rubrics": [
    {
      "id": "content1",
      "score": 8
    },
    {
      "id": "content2", 
      "score": 7
    }
  ]
}
```

#### Example Request
```bash
curl -X POST "https://api.aigrader.com/v1/students/1/grades" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"rubrics": [{"id": "content1", "score": 8}]}'
```

#### Example Response
```json
{
  "data": true,
  "success": true,
  "message": "Grades saved successfully"
}
```

#### Response Codes
- `200` - Success
- `400` - Bad Request (invalid data)
- `404` - Student not found
- `401` - Unauthorized

---

### 6. Submit Final Grades

**POST** `/grades/submit`

Submit final grades for multiple students.

#### Request Body
```json
{
  "studentIds": ["1", "2", "3"]
}
```

#### Example Request
```bash
curl -X POST "https://api.aigrader.com/v1/grades/submit" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"studentIds": ["1", "2", "3"]}'
```

#### Example Response
```json
{
  "data": true,
  "success": true,
  "message": "Grades submitted successfully"
}
```

#### Response Codes
- `200` - Success
- `400` - Bad Request (invalid student IDs)
- `401` - Unauthorized
- `500` - Internal Server Error

---

## RAG-Based AI Grading Endpoints

### 7. Create Marking Scheme

**POST** `/marking-schemes`

Create a new marking scheme for an essay question with custom criteria.

#### Request Body
```json
{
  "questionId": "string",
  "questionType": "string", // "essay", "multiple_choice", "short_answer"
  "rubricText": "string", // detailed rubric description
  "criteria": [
    {
      "name": "string", // e.g., "Content"
      "description": "string",
      "maxScore": "number",
      "weight": "number?" // optional, default 1.0
    }
  ]
}
```

#### Example Request
```bash
curl -X POST "https://api.aigrader.com/v1/marking-schemes" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "essay1",
    "questionType": "essay",
    "rubricText": "**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis...",
    "criteria": [
      {
        "name": "Content",
        "description": "Quality of ideas and analysis",
        "maxScore": 10,
        "weight": 1.0
      },
      {
        "name": "Organization",
        "description": "Structure and flow of essay",
        "maxScore": 5,
        "weight": 0.8
      }
    ]
  }'
```

#### Example Response
```json
{
  "data": {
    "id": "scheme123",
    "questionId": "essay1",
    "questionType": "essay",
    "criteria": [
      {
        "id": "content",
        "name": "Content",
        "description": "Quality of ideas and analysis",
        "maxScore": 10,
        "weight": 1.0
      }
    ],
    "rawText": "**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis...",
    "createdBy": "ta123",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "success": true,
  "message": "Marking scheme created successfully"
}
```

#### Response Codes
- `201` - Created successfully
- `400` - Bad Request (invalid data)
- `401` - Unauthorized

---

### 8. Get Marking Scheme

**GET** `/marking-schemes/{id}`

Retrieve a specific marking scheme by ID.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Marking scheme ID |

#### Example Request
```bash
curl -X GET "https://api.aigrader.com/v1/marking-schemes/scheme123" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

#### Example Response
```json
{
  "data": {
    "id": "scheme123",
    "questionId": "essay1",
    "questionType": "essay",
    "criteria": [...],
    "rawText": "**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis...",
    "createdBy": "ta123",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "success": true,
  "message": "Marking scheme retrieved successfully"
}
```

#### Response Codes
- `200` - Success
- `404` - Marking scheme not found
- `401` - Unauthorized

---

### 9. Get Marking Schemes by Question

**GET** `/questions/{questionId}/marking-schemes`

Retrieve all marking schemes for a specific question.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| questionId | string | Yes | Question ID |

#### Example Request
```bash
curl -X GET "https://api.aigrader.com/v1/questions/essay1/marking-schemes" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

#### Example Response
```json
{
  "data": [
    {
      "id": "scheme123",
      "questionId": "essay1",
      "questionType": "essay",
      "criteria": [...],
      "rawText": "**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis...",
      "createdBy": "ta123",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "success": true,
  "message": "Marking schemes retrieved successfully"
}
```

#### Response Codes
- `200` - Success
- `404` - Question not found
- `401` - Unauthorized

---

### 10. Generate AI Grades

**POST** `/students/{studentId}/ai-grade`

Use RAG-based AI system to generate suggested grades for student essay.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentId | string | Yes | Student ID |

#### Request Body
```json
{
  "markingSchemeId": "string",
  "criteriaIds": ["string"] // optional - specific criteria to grade
}
```

#### Example Request
```bash
curl -X POST "https://api.aigrader.com/v1/students/1/ai-grade" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "markingSchemeId": "scheme123",
    "criteriaIds": ["content", "organization"]
  }'
```

#### Example Response
```json
{
  "data": {
    "studentId": "1",
    "results": [
      {
        "criterionId": "content",
        "criterionName": "Content",
        "score": 8,
        "maxScore": 10,
        "justification": "The essay demonstrates strong understanding with clear examples and analysis",
        "suggestionForImprovement": "Consider adding more empirical evidence to strengthen arguments",
        "highlightedText": "The planning fallacy occurs when people underestimate the time needed",
        "confidence": 0.85
      }
    ],
    "totalScore": 23,
    "maxTotalScore": 30,
    "overallFeedback": "Strong essay with good analysis, could benefit from more evidence",
    "processedAt": "2024-01-15T10:30:00Z"
  },
  "success": true,
  "message": "AI grades generated successfully"
}
```

#### Response Codes
- `200` - Success
- `400` - Bad Request (invalid marking scheme)
- `404` - Student or marking scheme not found
- `401` - Unauthorized
- `500` - AI service error

---

### 11. Populate AI Suggested Score

**PUT** `/students/{studentId}/rubrics/{rubricId}/ai-populate`

Generate and populate AI suggested score for a specific rubric criterion.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentId | string | Yes | Student ID |
| rubricId | string | Yes | Rubric criterion ID |

#### Request Body
```json
{
  "markingSchemeId": "string"
}
```

#### Example Request
```bash
curl -X PUT "https://api.aigrader.com/v1/students/1/rubrics/content1/ai-populate" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"markingSchemeId": "scheme123"}'
```

#### Example Response
```json
{
  "data": true,
  "success": true,
  "message": "AI suggested score populated successfully"
}
```

#### Response Codes
- `200` - Success
- `400` - Bad Request (invalid marking scheme)
- `404` - Student, rubric, or marking scheme not found
- `401` - Unauthorized
- `500` - AI service error

---

## Error Handling

### Error Response Format
```json
{
  "data": null,
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error details"
  }
}
```

### Common Error Codes
| Code | Description |
|------|-------------|
| `INVALID_TOKEN` | Authentication token is invalid or expired |
| `STUDENT_NOT_FOUND` | Requested student does not exist |
| `RUBRIC_NOT_FOUND` | Requested rubric does not exist |
| `MARKING_SCHEME_NOT_FOUND` | Requested marking scheme does not exist |
| `QUESTION_NOT_FOUND` | Requested question does not exist |
| `INVALID_SCORE` | Score is outside valid range |
| `VALIDATION_ERROR` | Request data validation failed |
| `AI_SERVICE_ERROR` | AI grading service is unavailable or failed |
| `RUBRIC_PARSING_ERROR` | Failed to parse rubric text |
| `VECTOR_STORE_ERROR` | Vector storage operation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

---

## Rate Limiting

API requests are limited to:
- **100 requests per minute** for read operations
- **50 requests per minute** for write operations

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## Webhooks

### Grade Submission Webhook
When grades are submitted, a webhook is sent to your configured endpoint:

**POST** `{your-webhook-url}`

```json
{
  "event": "grades.submitted",
  "data": {
    "studentIds": ["1", "2", "3"],
    "submittedAt": "2024-01-15T10:30:00Z",
    "submittedBy": "instructor@university.edu"
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import { GradingService } from '@aigrader/sdk';

const grading = new GradingService('your-api-token');

// Get students
const students = await grading.getStudents('CS101', 'essay1');

// Create marking scheme
const markingScheme = await grading.createMarkingScheme({
  questionId: 'essay1',
  questionType: 'essay',
  rubricText: '**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis...',
  criteria: [
    { name: 'Content', description: 'Quality of ideas', maxScore: 10 },
    { name: 'Organization', description: 'Structure and flow', maxScore: 5 }
  ]
});

// Generate AI grades
const aiGrades = await grading.generateAIGrades('1', {
  markingSchemeId: 'scheme123',
  criteriaIds: ['content', 'organization']
});

// Update score
await grading.updateRubricScore('1', 'content1', 8);

// Populate AI suggested score
await grading.populateAISuggestedScore('1', 'content1', 'scheme123');

// Submit grades
await grading.submitGrades(['1', '2', '3']);
```

### Python
```python
from aigrader import GradingClient

client = GradingClient('your-api-token')

# Get students
students = client.get_students(course_id='CS101', exam_id='essay1')

# Create marking scheme
marking_scheme = client.create_marking_scheme({
    'questionId': 'essay1',
    'questionType': 'essay',
    'rubricText': '**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis...',
    'criteria': [
        {'name': 'Content', 'description': 'Quality of ideas', 'maxScore': 10},
        {'name': 'Organization', 'description': 'Structure and flow', 'maxScore': 5}
    ]
})

# Generate AI grades
ai_grades = client.generate_ai_grades('1', {
    'markingSchemeId': 'scheme123',
    'criteriaIds': ['content', 'organization']
})

# Update score
client.update_rubric_score('1', 'content1', 8)

# Populate AI suggested score
client.populate_ai_suggested_score('1', 'content1', 'scheme123')

# Submit grades
client.submit_grades(['1', '2', '3'])
```

---

## Testing

### Test Environment
Base URL: `https://api-test.aigrader.com/v1`

### Sample Test Data
Use these test student IDs for development:
- `test_student_1` - High-performing student
- `test_student_2` - Average-performing student  
- `test_student_3` - Low-performing student

### Postman Collection
Download our Postman collection: [AI Grader API.postman_collection.json](./postman/AI_Grader_API.postman_collection.json)

---

## Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Basic CRUD operations for students and grades
- Rubric scoring system
- Pagination support

### v1.1.0 (2024-02-01)
- Added webhook support
- Enhanced error handling
- Rate limiting implementation

### v1.2.0 (2024-03-01)
- **NEW**: RAG-based AI grading system
- **NEW**: Marking scheme management endpoints
- **NEW**: Custom criteria configuration for TAs
- **NEW**: AI-generated scores with detailed justifications
- **NEW**: Text highlighting and improvement suggestions
- **ENHANCED**: Extended RubricCriteria with AI fields
- **ENHANCED**: Improved error handling for AI services

---

## Support

For API support, contact:
- **Email**: api-support@aigrader.com
- **Documentation**: https://docs.aigrader.com
- **Status Page**: https://status.aigrader.com