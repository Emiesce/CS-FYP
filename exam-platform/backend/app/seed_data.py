from __future__ import annotations


DEMO_USERS = [
    {
        "id": "stu-001",
        "email": "student@ust.hk",
        "password": "student123",
        "first_name": "Alex",
        "last_name": "Chan",
        "role": "student",
        "student_number": "20845671",
        "avatar_url": "/avatars/student-01.jpg",
    },
    {
        "id": "staff-001",
        "email": "instructor@ust.hk",
        "password": "instructor123",
        "first_name": "Dr. Wong",
        "last_name": "Mei Ling",
        "role": "instructor",
        "student_number": None,
        "avatar_url": None,
    },
    {
        "id": "staff-002",
        "email": "ta@ust.hk",
        "password": "ta123",
        "first_name": "Kevin",
        "last_name": "Lau",
        "role": "teaching_assistant",
        "student_number": None,
        "avatar_url": None,
    },
    {
        "id": "admin-001",
        "email": "admin@ust.hk",
        "password": "admin123",
        "first_name": "System",
        "last_name": "Administrator",
        "role": "administrator",
        "student_number": None,
        "avatar_url": None,
    },
]


DEMO_COURSES = [
    {
        "id": "course-comp1023",
        "code": "COMP1023",
        "name": "Introduction to Python Programming",
        "semester_id": "2025-26-spring",
        "instructor_ids": ["staff-001"],
        "ta_ids": ["staff-002"],
        "student_ids": ["stu-001"],
    },
    {
        "id": "course-mgmt2110",
        "code": "MGMT2110",
        "name": "Organizational Behavior",
        "semester_id": "2025-26-spring",
        "instructor_ids": ["staff-001"],
        "ta_ids": ["staff-002"],
        "student_ids": ["stu-001"],
    },
    {
        "id": "course-comp4321",
        "code": "COMP4321",
        "name": "Search Engines",
        "semester_id": "2025-26-spring",
        "instructor_ids": ["staff-001"],
        "ta_ids": [],
        "student_ids": ["stu-001"],
    },
    {
        "id": "course-comp2012",
        "code": "COMP2012",
        "name": "OOP & Data Structures",
        "semester_id": "2025-26-spring",
        "instructor_ids": [],
        "ta_ids": ["staff-002"],
        "student_ids": ["stu-001"],
    },
]


DEMO_CURRENT_EXAM = {
    "id": "comp1023-midterm-f25",
    "course_code": "COMP1023",
    "course_name": "Introduction to Python Programming",
    "course_id": "course-comp1023",
    "semester_id": "2025-26-spring",
    "status": "current",
    "title": "Midterm",
    "date": "2026-05-02",
    "start_time": "09:00",
    "duration_seconds": 180,
    "location": "Online Demo Workspace",
    "instructions": "This is a live demonstration of the COMP1023 Midterm examination with real-time proctoring enabled.",
}


DEMO_UPCOMING_EXAMS = [
    {
        "id": "exam_upcoming_001",
        "course_code": "COMP4321",
        "course_name": "Search Engines",
        "course_id": "course-comp4321",
        "semester_id": "2025-26-spring",
        "status": "upcoming",
        "title": "Search Ranking Quiz",
        "date": "2026-05-15",
        "start_time": "10:00",
        "duration_seconds": 5400,
        "location": "Room 4504",
        "instructions": "Bring your student ID and arrive 15 minutes early.",
    },
    {
        "id": "exam_upcoming_002",
        "course_code": "COMP2012",
        "course_name": "OOP & Data Structures",
        "course_id": "course-comp2012",
        "semester_id": "2025-26-spring",
        "status": "upcoming",
        "title": "Data Structures Midterm",
        "date": "2026-05-20",
        "start_time": "14:00",
        "duration_seconds": 7200,
        "location": "LT-J",
        "instructions": "Closed-book written examination.",
    },
]
