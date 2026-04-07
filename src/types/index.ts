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

// Rubric Upload Page interfaces
export interface RubricData {
    id: string;
    title: string;
    description: string;
    questions: RubricQuestion[];
    totalMinPoints: number;
    totalMaxPoints: number;
    courseId?: string;
    assignmentId?: string;
    createdAt: Date;
    updatedAt: Date;
    lectureNotes?: LectureNote[];
}

export interface RubricQuestion {
    id: string;
    title: string;
    description?: string;
    minScore: number; // float
    maxScore: number; // float
    scoringCriteria: ScoringCriterion[];
}

export interface ScoringCriterion {
    id: string;
    scoreRange: string; // e.g., "3", "1-2", "0"
    description: string; // e.g., "Excellent analysis with clear examples"
    minPoints: number;
    maxPoints: number;
}

export interface UploadedFile {
    id: string;
    filename: string;
    size: number;
    uploadDate: Date;
    processedContent?: string;
    rubricId?: string;
    status: 'uploading' | 'processing' | 'completed' | 'error';
    errorMessage?: string;
}

export interface Assignment {
    id: string;
    title: string;
    description?: string;
    courseId: string;
    dueDate?: Date;
    rubricId?: string;
    createdAt: Date;
}

// Lecture Notes interfaces
export interface LectureNote {
    id: string;
    backendId?: string;  // Backend UUID for file retrieval after page refresh
    filename: string;
    originalName: string;
    fileSize: number;
    fileType: 'pdf' | 'docx' | 'txt' | 'md';
    uploadedAt: Date;
    processedAt?: Date;
    extractedContent?: string;
    wordCount?: number;
    associatedRubrics: string[];
    metadata: {
        pageCount?: number;
        processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
        processingError?: string;
    };
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

// Rubric API specific response types
export interface RubricUploadResponse extends ApiResponse<RubricData> {
    fileId?: string;
    processingStatus?: 'pending' | 'completed' | 'failed';
}

export interface RubricListResponse extends PaginatedResponse<RubricData> {
    success?: boolean;
    message?: string;
    filters?: {
        courseId?: string;
        assignmentId?: string;
        dateRange?: {
            start: Date;
            end: Date;
        };
    };
}