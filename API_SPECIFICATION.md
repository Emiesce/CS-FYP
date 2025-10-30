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
  "highlightedText": "string?" // optional
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

Retrieve all students for a specific course and assignment.

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| courseId | string | No | Filter by course ID |
| assignmentId | string | No | Filter by assignment ID |

#### Example Request
```bash
curl -X GET "https://api.aigrader.com/v1/students?courseId=CS101&assignmentId=essay1" \
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
| `INVALID_SCORE` | Score is outside valid range |
| `VALIDATION_ERROR` | Request data validation failed |
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

// Update score
await grading.updateRubricScore('1', 'content1', 8);

// Submit grades
await grading.submitGrades(['1', '2', '3']);
```

### Python
```python
from aigrader import GradingClient

client = GradingClient('your-api-token')

# Get students
students = client.get_students(course_id='CS101', assignment_id='essay1')

# Update score
client.update_rubric_score('1', 'content1', 8)

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

---

## Support

For API support, contact:
- **Email**: api-support@aigrader.com
- **Documentation**: https://docs.aigrader.com
- **Status Page**: https://status.aigrader.com