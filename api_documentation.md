# DES2 - API Documentation
## Authentication

For this project:

```
v1/auth
```

```json
// User Object
{
    "uuid": "string",
    "email": "string",
    "name": "string",
    "role": "string",
}
```

### POST /auth/login
Authenticates an existing user (Student or Teaching Assistant) and returns access rights and refresh tokens using their email and password attributes.

```json
{
    "email": "string",
    "password": "string",
}
```

## Course

This object represents a specific course in the university. Used for grouping examinations of the same course, assigning users to the course they are responsible for (Teaching Staff/Administrator) or enrolled in (Student).

### Course Object

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
| semester | The current semester when the course is being offered
| instructor_id | ID of Instructor of the course |
| created_at | ISO 8601 timestamp of course creation |
| updated_at | ISO 8601 timestamp of course information update |
| status | Course Status: `active` or `archived` |



## Examination
### Examination Object
```
