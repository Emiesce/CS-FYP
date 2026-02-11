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

### Data Model Hierarchy

The system follows this hierarchy:
```
Exam (e.g., "CS101 Final Exam 2024")
 │
 ├── Question 1 (e.g., "Essay: Explain planning fallacy")
 │    └── MarkingScheme for Question 1
 │         ├── Criterion 1: Content (max 10 points)
 │         │    └── StudentGrade (John: 8/10, AI suggested: 7/10)
 │         ├── Criterion 2: Organization (max 5 points)
 │         │    └── StudentGrade (John: 4/5, AI suggested: 4/5)
 │         └── Criterion 3: Grammar (max 5 points)
 │              └── StudentGrade (John: 3/5, AI suggested: 4/5)
 │
 ├── Question 2 (e.g., "Multiple Choice")
 │    └── MarkingScheme for Question 2
 │         └── Criterion 1: Correctness (max 1 point)
 │
 └── Question 3 (e.g., "Short Answer")
      └── MarkingScheme for Question 3
           └── Criterion 1: Accuracy (max 5 points)
```

**Key Relationships:**
- **Exam** has many **Questions** (1:N)
- **Question** has one **MarkingScheme** (1:1)
- **MarkingScheme** has many **Criteria** (1:N)
- **Criterion** has many **StudentGrades** (1:N, one per student)
- **Student** submits **StudentAnswer** for each **Question** (N:M through StudentAnswer)

### Exam
```json
{
  "examId": "string",
  "courseId": "string",
  "title": "string",
  "year": "integer",
  "semester": "integer",
  "createdBy": "string",
  "createdAt": "string" // ISO 8601 datetime
}
```

### Question
```json
{
  "id": "string",
  "examId": "string", // Foreign key to Exam
  "questionNumber": "integer", // e.g., 1, 2, 3
  "questionText": "string",
  "questionType": "string", // "essay", "multiple_choice", "short_answer"
  "topicId": "string?", // optional - topic/category
  "totalMarks": "number" // Sum of all criteria maxScores in marking scheme
}
```

### MarkingScheme
```json
{
  "id": "string",
  "questionId": "string", // Foreign key to Question (1-to-1 relationship)
  "criteria": [Criterion], // Array of grading criteria
  "rubricText": "string", // Original rubric text for RAG processing
  "createdBy": "string", // TA who created the marking scheme
  "createdAt": "string" // ISO 8601 datetime
}
```

### Criterion
```json
{
  "id": "string",
  "markingSchemeId": "string", // Foreign key to MarkingScheme
  "name": "string", // e.g., "Content", "Organization", "Grammar"
  "description": "string", // What this criterion evaluates
  "maxScore": "number", // Maximum score for this criterion (e.g., 10)
  "weight": "number?" // optional, default 1.0 - Used for weighted scoring
}
```

### StudentAnswer
```json
{
  "id": "string",
  "studentID": "string", // Foreign key to Student
  "questionId": "string", // Foreign key to Question
  "answerText": "string", // Student's essay/answer
  "submittedAt": "string" // ISO 8601 datetime
}
```

### StudentGrade
```json
{
  "id": "string",
  "studentAnswerId": "string", // Foreign key to StudentAnswer
  "criterionId": "string", // Foreign key to Criterion
  "manualScore": "float", // Manual score set by TA (optional until graded)
  "aiSuggestedScore": "float", // AI-generated score 
  "highlightedText": "string", // optional - Relevant essay excerpts
  "aiJustification": "string", // optional - AI's detailed reasoning
  "aiSuggestion": "string", // optional - AI's improvement suggestion
  "gradedBy": "string", // TA who finalized the grade
  "gradedAt": "string" // ISO 8601 datetime
}
```

### Student
```json
{
  "studentID": "string", // Primary identifier - student number (e.g., "20841234")
  "name": "string",
  "itsc": "string"
}
```

### AIGradingResult
```json
{
  "criterionId": "string",
  "criterionName": "string",
  "score": "float", 
  "maxScore": "number", // Maximum possible score (e.g., 10)
  "justification": "string", // Detailed explanation of the score
  "suggestionForImprovement": "string", // Constructive feedback for improvement
  "highlightedText": "string", // optional - Relevant essay excerpts that support the score
  "confidence": "float" // 0-1 confidence level of the AI's assessment
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
      "studentID": "20841234",
      "name": "John Smith",
      "itsc": "jsmith",
      "answers": [
        {
          "id": "answer1",
          "questionId": "q1",
          "questionNumber": 1,
          "questionText": "Explain the concept of planning fallacy",
          "answerText": "Several factors contribute to the planning fallacy...",
          "grades": [
            {
              "id": "grade1",
              "criterionId": "crit1",
              "criterionName": "Content",
              "maxScore": 10,
              "manualScore": 8,
              "aiSuggestedScore": 7,
              "highlightedText": "complexity of tasks can obscure the true time and cost",
              "aiJustification": "The essay demonstrates understanding of planning fallacy with relevant examples, though analysis could be deeper",
              "aiSuggestion": "Consider adding more empirical evidence to strengthen your arguments"
            },
            {
              "id": "grade2",
              "criterionId": "crit2",
              "criterionName": "Organization",
              "maxScore": 5,
              "manualScore": 4,
              "aiSuggestedScore": 4,
              "highlightedText": "Therefore, we should invest more in these technologies",
              "aiJustification": "Clear structure with logical flow, minor transition improvements needed",
              "aiSuggestion": "Add explicit transition sentences between paragraphs"
            }
          ]
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
      "studentID": "20841234",
      "name": "John Smith",
      "itsc": "jsmith",
      "answers": [...]
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

**GET** `/students/{studentID}`

Retrieve a specific student by their student ID.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentID | string | Yes | Student ID (e.g., "20841234") |

#### Example Request
```bash
curl -X GET "https://api.aigrader.com/v1/students/20841234" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

#### Example Response
```json
{
  "data": {
    "studentID": "20841234",
    "name": "John Smith",
    "itsc": "jsmith",
    "answers": [...]
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

**PUT** `/students/{studentID}/rubrics/{rubricId}`

Update the score for a specific rubric of a student.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentID | string | Yes | Student ID (e.g., "20841234") |
| rubricId | string | Yes | Rubric ID |

#### Request Body
```json
{
  "score": 8
}
```

#### Example Request
```bash
curl -X PUT "https://api.aigrader.com/v1/students/20841234/rubrics/content1" \
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

**POST** `/students/{studentID}/grades`

Save all current grades for a student.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentID | string | Yes | Student ID (e.g., "20841234") |

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
curl -X POST "https://api.aigrader.com/v1/students/20841234/grades" \
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

**POST** `/questions/{questionId}/marking-scheme`

Create a new marking scheme for a specific question with custom criteria. Each question can only have one marking scheme.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| questionId | string | Yes | Question ID |

#### Request Body
```json
{
  "rubricText": "string", // detailed rubric description for RAG processing
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
curl -X POST "https://api.aigrader.com/v1/questions/q1/marking-scheme" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "rubricText": "**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis with strong supporting evidence. Good (7-8 pts): Solid analysis with adequate support. Needs Improvement (4-6 pts): Basic understanding but lacks depth. **Organization (Max 5 points)** - Excellent (5 pts): Logical structure with smooth transitions. Good (3-4 pts): Clear structure with minor issues. **Grammar (Max 5 points)** - Excellent (5 pts): No errors. Good (3-4 pts): Few minor errors.",
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
        "weight": 1.0
      },
      {
        "name": "Grammar",
        "description": "Language mechanics and correctness",
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
    "questionId": "q1",
    "criteria": [
      {
        "id": "crit1",
        "markingSchemeId": "scheme123",
        "name": "Content",
        "description": "Quality of ideas and analysis",
        "maxScore": 10,
        "weight": 1.0
      },
      {
        "id": "crit2",
        "markingSchemeId": "scheme123",
        "name": "Organization",
        "description": "Structure and flow of essay",
        "maxScore": 5,
        "weight": 1.0
      },
      {
        "id": "crit3",
        "markingSchemeId": "scheme123",
        "name": "Grammar",
        "description": "Language mechanics and correctness",
        "maxScore": 5,
        "weight": 0.8
      }
    ],
    "rubricText": "**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis with strong supporting evidence. Good (7-8 pts): Solid analysis with adequate support. Needs Improvement (4-6 pts): Basic understanding but lacks depth. **Organization (Max 5 points)** - Excellent (5 pts): Logical structure with smooth transitions. Good (3-4 pts): Clear structure with minor issues. **Grammar (Max 5 points)** - Excellent (5 pts): No errors. Good (3-4 pts): Few minor errors.",
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
    "exam_id": "exam001",
    "questionId": "essay1",
    "questionType": "essay",
    "criteria": [
      {
        "id": "content",
        "name": "Content",
        "description": "Quality of ideas and analysis",
        "maxScore": 10,
        "weight": 1.0
      },
      {
        "id": "organization",
        "name": "Organization",
        "description": "Structure and flow of essay",
        "maxScore": 5,
        "weight": 0.8
      }
    ],
    "rawText": "**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis with strong supporting evidence. Good (7-8 pts): Solid analysis with adequate support. **Organization (Max 5 points)** - Excellent (5 pts): Logical structure with smooth transitions...",
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
      "exam_id": "exam001",
      "questionId": "essay1",
      "questionType": "essay",
      "criteria": [
        {
          "id": "content",
          "name": "Content",
          "description": "Quality of ideas and analysis",
          "maxScore": 10,
          "weight": 1.0
        },
        {
          "id": "organization",
          "name": "Organization",
          "description": "Structure and flow of essay",
          "maxScore": 5,
          "weight": 0.8
        }
      ],
      "rawText": "**Content (Max 10 points)** - Excellent (9-10 pts): Clear, insightful analysis with strong supporting evidence. Good (7-8 pts): Solid analysis with adequate support. **Organization (Max 5 points)** - Excellent (5 pts): Logical structure with smooth transitions...",
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

**POST** `/students/{studentID}/ai-grade`

Use RAG-based AI system to generate suggested grades for student essay.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentID | string | Yes | Student ID (e.g., "20841234") |

#### Request Body
```json
{
  "markingSchemeId": "string",
  "criteriaIds": ["string"] // optional - specific criteria to grade
}
```

#### Example Request
```bash
curl -X POST "https://api.aigrader.com/v1/students/20841234/ai-grade" \
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
    "studentID": "20841234",
    "results": [
      {
        "criterionId": "content",
        "criterionName": "Content",
        "score": 8,
        "maxScore": 10,
        "justification": "The essay demonstrates strong understanding with clear examples and analysis. The student effectively explains the planning fallacy concept with relevant examples.",
        "suggestionForImprovement": "Consider adding more empirical evidence to strengthen arguments. Include specific studies or statistics to support your claims.",
        "highlightedText": "The planning fallacy occurs when people underestimate the time needed",
        "confidence": 0.85
      },
      {
        "criterionId": "organization",
        "criterionName": "Organization",
        "score": 7,
        "maxScore": 10,
        "justification": "The essay has a clear structure with logical flow between paragraphs. Transitions could be smoother in some sections.",
        "suggestionForImprovement": "Add more explicit transition sentences between main points to improve coherence.",
        "highlightedText": "Therefore, we should invest more in these technologies",
        "confidence": 0.78
      },
      {
        "criterionId": "evidence",
        "criterionName": "Use of Evidence",
        "score": 6,
        "maxScore": 10,
        "justification": "Evidence is present but lacks depth. Examples are mentioned but not thoroughly analyzed or integrated.",
        "suggestionForImprovement": "Provide more specific examples and explain how they support your thesis. Integrate evidence more smoothly into your arguments.",
        "highlightedText": "For example, a solar panel generates electricity from the sun",
        "confidence": 0.82
      }
    ],
    "totalScore": 21,
    "maxTotalScore": 30,
    "overallFeedback": "Strong essay with good understanding of the topic. To improve, focus on providing more detailed evidence and smoother transitions between ideas.",
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

**PUT** `/students/{studentID}/rubrics/{rubricId}/ai-populate`

Generate and populate AI suggested score for a specific rubric criterion.

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentID | string | Yes | Student ID (e.g., "20841234") |
| rubricId | string | Yes | Rubric criterion ID |

#### Request Body
```json
{
  "markingSchemeId": "string"
}
```

#### Example Request
```bash
curl -X PUT "https://api.aigrader.com/v1/students/20841234/rubrics/content1/ai-populate" \
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