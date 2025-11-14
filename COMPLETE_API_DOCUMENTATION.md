# Complete API Documentation

## Table of Contents
1. [Authentication](#authentication)
2. [Course Management](#course-management)
3. [Examination Management](#examination-management)
4. [AI Grading System](#ai-grading-system)
5. [Analytics](#analytics)
6. [Error Handling](#error-handling)
7. [SDK Examples](#sdk-examples)

---

## Base URLs
- **AI Grader API**: `https://api.aigrader.com/v1`
- **Analytics API**: `https://api.analytics.com/v1`
- **Auth API**: `https://api.aigrader.com/v1/auth`

## Authentication

### User Object
```json
{
    "uuid": "string",
    "email": "string",
    "name": "string",
    "role": "string"
}
```

### POST /auth/login
Authenticates an existing user (Student or Teaching Assistant) and returns access rights using their email and password attributes.

**Request Body:**
```json
{
    "email": "string",
    "password": "string"
}
```

**Response:**
```json
{
    "data": {
        "user": User,
        "accessToken": "string",
        "refreshToken": "string"
    },
    "success": true
}
```

---

## Course Management

### Course Object
This object represents a specific course in the university. Used for grouping examinations of the same course, assigning users to the course they are responsible for (Teaching Staff/Administrator) or enrolled in (Student).

```json
{
    "course_id": "string",
    "title": "string",
    "description": "string",
    "course_code": "string",
    "semester": "string",
    "instructor_id": "string",
    "created_at": "string (ISO 8601)",
    "updated_at": "string (ISO 8601)",
    "status": "string (active | archived)"
}
```

| Attributes | Description |
| --- | --- |
| course_id | Unique identifier for the course |
| title | Course Title (e.g. "Introduction to Computer Science") |
| description | Brief description of the course |
| course_code | Course Code according to university |
| semester | The current semester when the course is being offered |
| instructor_id | ID of Instructor of the course |
| created_at | ISO 8601 timestamp of course creation |
| updated_at | ISO 8601 timestamp of course information update |
| status | Course Status: `active` or `archived` |

---

## Examination Management

### Examination Object
```json
{
    "exam_id": "string",
    "course_id": "string",
    "created_at": "string (ISO 8601)",
    "updated_at": "string (ISO 8601)",
    "start_time": "string (ISO 8601)",
    "end_time": "string (ISO 8601)",
    "questions": "Question[]"
}
```

| Attributes | Description |
| --- | --- |
| exam_id | UUID of the examination paper |
| course_id | ID of the course that the examination is assigned to |
| start_time | Starting time when examination is open |
| end_time | Ending time of examination for automatic submission |
| questions | Array of Question objects to be solved for a specific exam |

---

## AI Grading System

### Data Model Hierarchy

The system follows this hierarchy:
```
Exam (e.g., "MGMT2011 Final Exam 2024")
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

### Core Data Models

#### Student
```json
{
  "studentID": "string",
  "name": "string",
  "itsc": "string"
}
```

#### Question
```json
{
  "id": "string",
  "examId": "string",
  "questionNumber": "integer",
  "questionText": "string",
  "questionType": "string",
  "topicId": "string",
  "totalMarks": "number"
}
```

#### MarkingScheme
```json
{
  "id": "string",
  "questionId": "string",
  "criteria": [Criterion],
  "rubricText": "string",
  "createdBy": "string",
  "createdAt": "string"
}
```

## AI Grading System

### Data Model Hierarchy

The system follows this hierarchy:
```
Exam (e.g., "MGMT2011 Final Exam 2024")
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

### Core Data Models

#### Student
```json
{
  "studentID": "string",
  "name": "string",
  "itsc": "string"
}
```

#### Question
```json
{
  "id": "string",
  "examId": "string",
  "questionNumber": "string",
  "questionText": "string",
  "questionType": "string",
  "topicId": "string",
  "totalMarks": "number"
}
```

#### MarkingScheme
```json
{
  "id": "string",
  "questionId": "string",
  "criteria": [Criterion],
  "rubricText": "string",
  "createdBy": "string",
  "createdAt": "string"
}
```

#### Criterion
```json
{
  "id": "string",
  "markingSchemeId": "string",
  "name": "string",
  "description": "string",
  "maxScore": "number",
  "weight": "number"
}
```

#### StudentAnswer
```json
{
  "id": "string",
  "studentID": "string",
  "questionId": "string",
  "answerText": "string",
  "submittedAt": "string"
}
```

#### StudentGrade (Stored)
```json
{
  "id": "string",
  "studentAnswerId": "string",
  "criterionId": "string",
  "manualScore": "float",
  "aiSuggestedScore": "float",
  "highlightedText": "string",
  "aiJustification": "string",
  "aiSuggestion": "string",
  "gradedBy": "string",
  "gradedAt": "string"
}
```

#### AIGradingResult (Temporary AI Output)
```json
{
  "criterionId": "string",
  "criterionName": "string",
  "score": "float",
  "maxScore": "number",
  "justification": "string",
  "suggestionForImprovement": "string",
  "highlightedText": "string",
  "confidence": "float"
}
```

---

## Student & Grading Endpoints

### 1. Get Students

**GET** `/students`

Retrieve all students for a specific course and exam.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| courseId | string | No | Filter by course ID |
| examId | string | No | Filter by exam ID |

**Example Response:**
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
  "success": true
}
```

### 2. Get Students (Paginated)

**GET** `/students/paginated`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number |
| limit | number | No | 10 | Items per page |
| courseId | string | No | - | Filter by course ID |

### 3. Get Student by ID

**GET** `/students/{studentID}`

Retrieve a specific student by their student ID.

### 4. Get Student Exam Results

**GET** `/students/{studentID}/exams/{examId}/results`

Get complete graded exam results for a student with all questions and grades.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| studentID | string | Yes | Student ID (e.g., "20841234") |
| examId | string | Yes | Exam ID |

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| includeAIFeedback | boolean | No | true | Include AI justifications and suggestions |
| includeAnswerText | boolean | No | true | Include student's answer text |

**Example Request:**
```bash
curl -X GET "https://api.aigrader.com/v1/students/20841234/exams/midterm/results" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json"
```

**Example Response:**
```json
{
  "data": {
    "studentID": "20841234",
    "studentName": "John Smith",
    "examId": "midterm",
    "examTitle": "MGMT2011 Midterm Exam",
    "courseId": "MGMT2011",
    "submittedAt": "2024-01-15T10:00:00Z",
    "gradedAt": "2024-01-16T14:30:00Z",
    "status": "graded",
    "questions": [
      {
        "questionId": "q1",
        "questionNumber": 1,
        "questionText": "Explain the concept of planning fallacy",
        "questionType": "essay",
        "topicId": "cognitive-bias",
        "studentAnswer": {
          "id": "answer1",
          "answerText": "Several factors contribute to the planning fallacy...",
          "submittedAt": "2024-01-15T09:30:00Z",
          "wordCount": 450
        },
        "criteria": [
          {
            "criterionId": "crit1",
            "criterionName": "Content",
            "description": "Quality of ideas and analysis",
            "maxScore": 10,
            "weight": 1.0,
            "grade": {
              "manualScore": 8,
              "aiSuggestedScore": 7,
              "highlightedText": "complexity of tasks can obscure the true time and cost",
              "aiJustification": "The essay demonstrates understanding of planning fallacy with relevant examples",
              "aiSuggestion": "Consider adding more empirical evidence to strengthen your arguments",
              "gradedBy": "ta123",
              "gradedAt": "2024-01-16T14:25:00Z"
            }
          },
          {
            "criterionId": "crit2",
            "criterionName": "Organization",
            "description": "Structure and flow of essay",
            "maxScore": 5,
            "weight": 1.0,
            "grade": {
              "manualScore": 4,
              "aiSuggestedScore": 4,
              "aiJustification": "Clear structure with logical flow",
              "aiSuggestion": "Add explicit transition sentences between paragraphs",
              "gradedBy": "ta123",
              "gradedAt": "2024-01-16T14:25:00Z"
            }
          }
        ],
        "questionTotalScore": 12,
        "questionMaxScore": 15,
        "questionPercentage": 80.0
      },
      {
        "questionId": "q2",
        "questionNumber": 2,
        "questionText": "What are the main causes of planning fallacy?",
        "questionType": "short_answer",
        "topicId": "cognitive-bias",
        "studentAnswer": {
          "id": "answer2",
          "answerText": "The main causes include optimism bias and lack of experience...",
          "submittedAt": "2024-01-15T09:45:00Z",
          "wordCount": 120
        },
        "criteria": [
          {
            "criterionId": "crit4",
            "criterionName": "Accuracy",
            "description": "Correctness of answer",
            "maxScore": 10,
            "weight": 1.0,
            "grade": {
              "manualScore": 8,
              "aiSuggestedScore": 8,
              "aiJustification": "Correctly identified main causes with good examples",
              "gradedBy": "ta123",
              "gradedAt": "2024-01-16T14:30:00Z"
            }
          }
        ],
        "questionTotalScore": 8,
        "questionMaxScore": 10,
        "questionPercentage": 80.0
      }
    ],
    "summary": {
      "totalScore": 20,
      "maxScore": 25,
      "percentage": 80.0,
      "grade": "B+",
      "totalQuestions": 2,
      "gradedQuestions": 2,
      "pendingQuestions": 0
    }
  },
  "success": true,
  "message": "Exam results retrieved successfully"
}
```

**Response Codes:**
- `200` - Success
- `404` - Student or exam not found
- `401` - Unauthorized

### 5. Get Batch Exam Results

**POST** `/exams/{examId}/results/batch`

Get exam results for multiple students at once.

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| examId | string | Yes | Exam ID |

**Request Body:**
```json
{
  "studentIDs": ["20841234", "20845678", "20849012"],
  "includeAIFeedback": true,
  "includeAnswerText": false
}
```

**Example Response:**
```json
{
  "data": [
    {
      "studentID": "20841234",
      "studentName": "John Smith",
      "totalScore": 20,
      "maxScore": 25,
      "percentage": 80.0,
      "status": "graded",
      "questions": [...]
    },
    {
      "studentID": "20845678",
      "studentName": "Jane Doe",
      "totalScore": 23,
      "maxScore": 25,
      "percentage": 92.0,
      "status": "graded",
      "questions": [...]
    },
    {
      "studentID": "20849012",
      "studentName": "Bob Wilson",
      "totalScore": 0,
      "maxScore": 25,
      "percentage": 0,
      "status": "pending",
      "questions": []
    }
  ],
  "success": true,
  "message": "Batch exam results retrieved successfully"
}
```

**Response Codes:**
- `200` - Success
- `400` - Bad Request (invalid student IDs)
- `404` - Exam not found
- `401` - Unauthorized

### 6. Update Rubric Score

**PUT** `/students/{studentID}/rubrics/{rubricId}`

Update the score for a specific rubric of a student.

**Request Body:**
```json
{
  "score": 8
}
```

### 7. Save Student Grades

**POST** `/students/{studentID}/grades`

Save all current grades for a student.

**Request Body:**
```json
{
  "rubrics": [
    {
      "id": "content1",
      "score": 8
    }
  ]
}
```

### 8. Submit Final Grades

**POST** `/grades/submit`

Submit final grades for multiple students.

**Request Body:**
```json
{
  "studentIds": ["20841234", "20845678"]
}
```

---

## RAG-Based AI Grading Endpoints

### 9. Create Marking Scheme

**POST** `/questions/{questionId}/marking-scheme`

Create a new marking scheme for a specific question with custom criteria.

**Request Body:**
```json
{
  "rubricText": "string",
  "criteria": [
    {
      "name": "Content",
      "description": "Quality of ideas and analysis",
      "maxScore": 10,
      "weight": 1.0
    }
  ]
}
```

**Example Response:**
```json
{
  "data": {
    "id": "scheme123",
    "questionId": "q1",
    "criteria": [
      {
        "id": "crit1",
        "name": "Content",
        "maxScore": 10
      }
    ],
    "rubricText": "...",
    "createdBy": "ta123",
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "success": true
}
```

### 10. Get Marking Scheme

**GET** `/marking-schemes/{id}`

Retrieve a specific marking scheme by ID.

### 11. Get Marking Schemes by Question

**GET** `/questions/{questionId}/marking-schemes`

Retrieve all marking schemes for a specific question.

### 12. Generate AI Grades

**POST** `/students/{studentID}/ai-grade`

Use RAG-based AI system to generate suggested grades for student essay.

**Request Body:**
```json
{
  "markingSchemeId": "scheme123",
  "criteriaIds": ["content", "organization"]
}
```

**Example Response:**
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
        "justification": "The essay demonstrates strong understanding...",
        "suggestionForImprovement": "Consider adding more empirical evidence...",
        "highlightedText": "The planning fallacy occurs when...",
        "confidence": 0.85
      }
    ],
    "totalScore": 21,
    "maxTotalScore": 30,
    "overallFeedback": "Strong essay with good understanding...",
    "processedAt": "2024-01-15T10:30:00Z"
  },
  "success": true
}
```

### 13. Populate AI Suggested Score

**PUT** `/students/{studentID}/rubrics/{rubricId}/ai-populate`

Generate and populate AI suggested score for a specific rubric criterion.

---

## Analytics Endpoints

### Analytics Data Models

#### Exam Analytics
```json
{
  "studentId": "string",
  "courseId": "string",
  "year": "integer",
  "sem": "integer",
  "examId": "string",
  "totalDuration": "float",
  "flaggedCount": "integer",
  "questions": [Question]
}
```

#### Question Analytics
```json
{
  "studentId": "string",
  "courseId": "string",
  "year": "integer",
  "sem": "integer",
  "examId": "string",
  "questionId": "string",
  "questionType": "string",
  "topicId": "string",
  "answer": "string",
  "answerChangeCount": "integer",
  "flagged": "boolean"
}
```

### 1. Get Student Exam Information

**GET** `/examInfo/{studentId}/{courseId}/{year}/{sem}/{examId}`

Retrieve specific basic information exam of a student.

**Example:**
```bash
GET /examInfo/20719437/COMP1021/2024/1/midterm
```

**Response:**
```json
{
  "data": {
    "studentId": "20719437",
    "courseId": "COMP1021",
    "year": 2024,
    "sem": 1,
    "examId": "midterm",
    "totalDuration": 3509.3,
    "flaggedCount": 3,
    "questions": [
      {
        "questionId": "1",
        "questionType": "essay",
        "topicId": "Heat",
        "answer": "The temperature is decreasing by 20%.",
        "answerChangeCount": 2,
        "flagged": true
      }
    ]
  },
  "success": true
}
```

**Response Codes:**
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Student or exam not found
- `500` - Internal Server Error

### 2. Get Question Grade

**GET** `/questionGrade/{studentId}/{courseId}/{year}/{sem}/{examId}/{questionId}`

Retrieve a student's grade for a question in an exam from the AI grader.

**Example Response:**
```json
{
  "data": {
    "studentId": "20719437",
    "courseId": "COMP1021",
    "questionId": "1",
    "topicId": "Heat",
    "answer": "The temperature is decreasing by 20%.",
    "score": 10.0,
    "maxScore": 10.0,
    "overallFeedback": "The analysis clearly follows the logic..."
  },
  "success": true
}
```

### 3. Get Class Analytics

**GET** `/classAnalytics/{courseId}/{year}/{sem}/{examId}`

Retrieve a class's exam analytics (pre-computed) after all students' answers are graded.

**Example Response:**
```json
{
  "data": {
    "courseId": "COMP1021",
    "year": 2024,
    "sem": 1,
    "examId": "midterm",
    "maxScore": 20.0,
    "averageScore": 14.5,
    "q1Score": 8.7,
    "medianScore": 15.0,
    "q3Score": 18.2,
    "stdDeviation": 3.2,
    "maxCompletionTime": 3600.0,
    "avgCompletionTime": 2520.1,
    "scoreDistribution": [1, 2, 3, 3, 7, 12, 4, 16, 6, 2],
    "completionTimeDistribution": [8, 3, 6, 12, 15],
    "topicScores": [
      {
        "topicId": "Heat",
        "aggregateScore": 0.85
      }
    ],
    "commonMisconception": ["Confusing temperature with heat"],
    "recommendations": ["Increase focus on thermodynamics fundamentals"],
    "rubricBreakdown": [
      {
        "rubricId": "1",
        "aggregateScore": 0.78
      }
    ]
  },
  "success": true
}
```

### 4. Get Class Question Analytics

**GET** `/classAnalytics/questions/{courseId}/{year}/{sem}/{examId}/{questionId}`

Retrieve the analysis for each exam question on the class level with AI.

**Example Response:**
```json
{
  "data": {
    "courseId": "COMP1021",
    "questionId": "1",
    "topicId": "Heat",
    "aggregateScore": 0.91,
    "summary": "Some confusion with free body diagrams.",
    "commonWrongAns": [
      {
        "answer": "The answer is 5%.",
        "explanation": "Misread circuit diagram",
        "distribution": 0.05
      }
    ]
  },
  "success": true
}
```

### 5. Get Analysis & Recommendations

**GET** `/studentRecs/{studentId}/{courseId}/{year}/{sem}/{examId}/{questionId}`

Retrieve detailed analysis and suggestions from AI for a question upon student request.

**Example Response:**
```json
{
  "data": {
    "studentId": "20719437",
    "courseId": "COMP1021",
    "questionId": "2",
    "topicId": "Heat",
    "feedback": "Based on your answer, you should spend more time...",
    "humanApproved": false,
    "feedbackApprover": ""
  },
  "success": true,
  "message": "Recommendation generated by AI, pending human approval."
}
```

### 6. Update Analysis & Recommendations (TA Approval)

**POST** `/studentRecs/{studentId}/{courseId}/{year}/{sem}/{examId}/{questionId}`

Add or update human feedback/approval for the AI analysis.

**Request Body:**
```json
{
  "feedback": "Good initial attempt. Please review topic notes..."
}
```

**Example Response:**
```json
{
  "data": {
    "studentId": "20719437",
    "feedback": "Good initial attempt. Please review topic notes...",
    "humanApproved": true,
    "feedbackApprover": "Hans B.",
    "approvedAt": "2025-11-08T19:31:00+08:00"
  },
  "success": true
}
```

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
| `EXAM_NOT_FOUND` | Requested exam does not exist |
| `INVALID_SCORE` | Score is outside valid range |
| `VALIDATION_ERROR` | Request data validation failed |
| `AI_SERVICE_ERROR` | AI grading service is unavailable or failed |
| `RUBRIC_PARSING_ERROR` | Failed to parse rubric text |
| `VECTOR_STORE_ERROR` | Vector storage operation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

---


## Webhooks

### Grade Submission Webhook
When grades are submitted, a webhook is sent to your configured endpoint:

**POST** `{your-webhook-url}`

```json
{
  "event": "grades.submitted",
  "data": {
    "studentIds": ["20841234", "20845678"],
    "submittedAt": "2024-01-15T10:30:00Z",
    "submittedBy": "instructor@ust.hk"
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
const students = await grading.getStudents('MGMT2011', 'essay1');

// Create marking scheme
const markingScheme = await grading.createMarkingScheme({
  questionId: 'essay1',
  rubricText: '**Content (Max 10 points)** - Excellent (9-10 pts)...',
  criteria: [
    { name: 'Content', description: 'Quality of ideas', maxScore: 10 },
    { name: 'Organization', description: 'Structure and flow', maxScore: 5 }
  ]
});

// Generate AI grades
const aiGrades = await grading.generateAIGrades('20841234', {
  markingSchemeId: 'scheme123',
  criteriaIds: ['content', 'organization']
});

// Update score
await grading.updateRubricScore('20841234', 'content1', 8);

// Submit grades
await grading.submitGrades(['20841234', '20845678']);
```

### Python
```python
from aigrader import GradingClient

client = GradingClient('your-api-token')

# Get students
students = client.get_students(course_id='MGMT2011', exam_id='essay1')

# Create marking scheme
marking_scheme = client.create_marking_scheme({
    'questionId': 'essay1',
    'rubricText': '**Content (Max 10 points)** - Excellent (9-10 pts)...',
    'criteria': [
        {'name': 'Content', 'description': 'Quality of ideas', 'maxScore': 10},
        {'name': 'Organization', 'description': 'Structure and flow', 'maxScore': 5}
    ]
})

# Generate AI grades
ai_grades = client.generate_ai_grades('20841234', {
    'markingSchemeId': 'scheme123',
    'criteriaIds': ['content', 'organization']
})

# Update score
client.update_rubric_score('20841234', 'content1', 8)

# Submit grades
client.submit_grades(['20841234', '20845678'])
```

---

## Testing

### Test Environment
- **AI Grader API**: `https://api-test.aigrader.com/v1`
- **Analytics API**: `https://api-test.analytics.com/v1`

### Sample Test Data
Use these test student IDs for development:
- `test_student_1` - High-performing student
- `test_student_2` - Average-performing student  
- `test_student_3` - Low-performing student




---

## Calculated Fields Note

**Important:** The following fields in API responses are calculated at runtime and NOT stored in the database:

- 📊 `totalMarks` (Question) - Sum of all criteria maxScores
- 📊 `questionTotalScore` - Sum of all criterion scores for a question  
- 📊 `examTotalScore` - Sum of all question scores
- 📊 `percentage` - Calculated from (totalScore / maxScore * 100)
- 📊 `grade` - Letter grade derived from percentage (A+, A, B+, etc.)
- 📊 `wordCount` - Calculated from answer text using word count algorithm
- 📊 All `summary` objects - Aggregated statistics from stored data

These values are computed on-the-fly when generating API responses to ensure data consistency and avoid redundancy.

---
