// Core interfaces for the grading system

export interface RubricCriteria {
    id: string;
    title: string;
    description: string;
    score: number;
    maxScore: number;
    aiSuggestedScore: number;
    highlightedText?: string;
}

export interface Student {
    id: string;
    studentNumber: string;
    name: string;
    essay: string;
    rubrics: RubricCriteria[];
}

export interface Course {
    id: string;
    name: string;
    code: string;
    semester: string;
}

export interface GradingSession {
    id: string;
    courseId: string;
    assignmentId: string;
    studentIds: string[];
    currentStudentIndex: number;
    lastSaved: Date;
    isAutoSaving: boolean;
}

export interface UserEditedScores {
    [key: string]: boolean; // Format: "studentIndex-rubricId": boolean
}

// API Response types
export interface ApiResponse<T> {
    data: T;
    success: boolean;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}