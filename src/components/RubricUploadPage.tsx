import React, { useState, useRef } from "react";
import { Button } from "./ui/button";
import { Menu, Plus, Upload, FileText, Trash2, X, Edit } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { useRubricController } from "../hooks/useRubricController";
import { FileUploadDropzone } from "./rubric/FileUploadDropzone";
import { RubricGrid } from "./rubric/RubricGrid";
import { LoadingSpinner, LoadingState } from "./ui/loading-spinner";
import { useToast } from "./ui/toast";
import { ErrorBoundary } from "./ui/error-boundary";
import { RubricData, LectureNote, RubricCriterion, ScoreLevel } from "../types";
import { LectureNotesSection } from "./rubric/LectureNotesSection";
import { LectureNotesDisplay } from "./rubric/LectureNotesDisplay";
import "./rubric-styles.css";

interface RubricUploadPageProps {
    courseId?: string;
}

export function RubricUploadPage({ courseId }: RubricUploadPageProps = {}) {
    console.log('RubricUploadPage rendering with courseId:', courseId);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [activeView, setActiveView] = useState<'upload' | 'manage' | 'create' | 'view' | 'edit'>('manage');
    const [selectedRubric, setSelectedRubric] = useState<RubricData | null>(null);
    const [editSessionKey, setEditSessionKey] = useState(0);
    const { addToast } = useToast();

    // Use the rubric controller hook directly - don't wrap in try-catch as it causes re-initialization
    const hookData = useRubricController({ courseId });

    // Real file upload handler - direct service call
    const handleFileUpload = async (file: File): Promise<void> => {
        try {
            console.log('=== DIRECT UPLOAD START ===');
            console.log('Starting direct file upload:', {
                name: file.name,
                type: file.type,
                size: file.size
            });

            // Import and use the service directly
            const { RubricService } = await import('../services/RubricService');
            const rubricService = new RubricService();

            const response = await rubricService.uploadRubricFile(file, undefined); // Don't filter by courseId
            console.log('Direct upload response:', response);

            if (response.success) {
                addToast({
                    type: 'success',
                    title: 'Upload Successful',
                    description: `File "${file.name}" uploaded successfully!`
                });

                console.log('Upload successful, refreshing rubrics list...');
                console.log('Current rubrics count before refresh:', hookData?.rubrics?.length || 0);
                // Refresh the rubrics list to show the new upload
                if (hookData?.refreshRubrics) {
                    console.log('Calling refreshRubrics...');
                    await hookData.refreshRubrics();
                    console.log('refreshRubrics completed');
                    console.log('Current rubrics count after refresh:', hookData?.rubrics?.length || 0);
                } else {
                    console.error('refreshRubrics not available');
                }

                // Switch to manage view to show the uploaded rubric
                setActiveView('manage');
            } else {
                const error = response.message || 'Upload failed';
                console.error('Direct upload failed:', error);
                addToast({
                    type: 'error',
                    title: 'Upload Failed',
                    description: error,
                    duration: 8000
                });
                throw new Error(error);
            }
            console.log('=== DIRECT UPLOAD END ===');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            console.error('Direct upload error:', error);
            addToast({
                type: 'error',
                title: 'Upload Error',
                description: errorMessage,
                duration: 8000
            });
            throw error;
        }
    };

    // Success and error handlers for components
    const handleSuccess = (message: string) => {
        addToast({
            type: 'success',
            title: 'Success',
            description: message
        });
    };

    const handleError = (error: string) => {
        addToast({
            type: 'error',
            title: 'Error',
            description: error,
            duration: 8000
        });
    };

    // Get data from hook with defaults
    const rubrics = hookData?.rubrics || [];
    const courses = hookData?.courses || [];
    const assignments = hookData?.assignments || [];
    const loadingState = hookData?.loadingState || {
        rubrics: false,
        courses: false,
        assignments: false,
        creating: false,
        updating: false,
        deleting: false,
        uploading: false,
        assigning: false
    };
    const fileUploadState = hookData?.fileUploadState || { status: 'idle' as const, progress: 0 };

    // Handler functions
    const handleCreateRubric = () => {
        setActiveView('create');
    };

    // View and Edit handlers
    const handleViewRubric = (rubric: RubricData) => {
        // Always use the latest version from the rubrics list
        const latest = hookData?.rubrics?.find(r => r.id === rubric.id) || rubric;
        setSelectedRubric(latest);
        setActiveView('view');
    };

    const handleEditRubric = (rubric: RubricData) => {
        // Always use the latest version from the rubrics list
        const latest = hookData?.rubrics?.find(r => r.id === rubric.id) || rubric;
        console.log('=== EDIT RUBRIC ===', latest.id, 'lectureNotes:', latest.lectureNotes?.length ?? 0);
        setSelectedRubric(latest);
        setEditSessionKey(k => k + 1);
        setActiveView('edit');
    };
    const handleDeleteRubric = async (rubricId: string) => {
        if (confirm('Are you sure you want to delete this rubric?')) {
            try {
                if (hookData?.deleteRubric) {
                    const success = await hookData.deleteRubric(rubricId);
                    if (success) {
                        handleSuccess('Rubric deleted successfully');
                        await hookData.refreshRubrics();
                    } else {
                        handleError('Failed to delete rubric');
                    }
                }
            } catch (error) {
                handleError(error instanceof Error ? error.message : 'Failed to delete rubric');
            }
        }
    };

    const handleBackToManage = () => {
        setSelectedRubric(null);
        setActiveView('manage');
    };

    // Show loading screen for initial page load
    if (!hookData) {
        return (
            <div className="rubric-loading-container">
                <LoadingSpinner
                    size="xl"
                    text="Loading Rubric Management"
                    variant="default"
                />
            </div>
        );
    }

    const handleTestBackend = async () => {
        try {
            addToast({
                type: 'info',
                title: 'Testing Connection',
                description: 'Checking backend connectivity...'
            });

            const response = await fetch('http://localhost:5000/health');
            const result = await response.json();

            addToast({
                type: 'success',
                title: 'Backend Connected',
                description: `Available methods: ${result.available_methods.join(', ')}`,
                duration: 6000
            });
        } catch (error) {
            addToast({
                type: 'error',
                title: 'Connection Failed',
                description: 'Backend not accessible. Make sure Python server is running on port 5000.',
                duration: 8000
            });
        }
    };

    try {
        return (
            <ErrorBoundary onError={(error, errorInfo) => {
                console.error('RubricUploadPage Error:', error, errorInfo);
                addToast({
                    type: 'error',
                    title: 'Application Error',
                    description: 'An unexpected error occurred. Please refresh the page.',
                    duration: 10000
                });
            }}>
                <div className="rubric-upload-container">
                    {/* Sidebar */}
                    <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

                    <div className="rubric-main-layout">
                        {/* Top Bar */}
                        <div className="rubric-top-bar">
                            <div className="rubric-top-bar-content">
                                <div className="rubric-top-bar-left">
                                    {sidebarCollapsed && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                                            className="flex items-center gap-2"
                                        >
                                            <Menu className="rubric-icon-small" />
                                        </Button>
                                    )}
                                    <h2 className="rubric-top-bar-title">Rubric Management</h2>
                                </div>
                                <div className="rubric-navigation-buttons">
                                    <Button
                                        size="sm"
                                        onClick={() => setActiveView('upload')}
                                        className={`rubric-navigation-button ${activeView === 'upload'
                                            ? 'rubric-navigation-button-active'
                                            : 'rubric-navigation-button-inactive'
                                            }`}
                                    >
                                        <Upload className="rubric-icon-small" />
                                        Upload
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => setActiveView('create')}
                                        className={`rubric-navigation-button ${activeView === 'create'
                                            ? 'rubric-navigation-button-active'
                                            : 'rubric-navigation-button-inactive'
                                            }`}
                                    >
                                        <Plus className="rubric-icon-small" />
                                        Create
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => setActiveView('manage')}
                                        className={`rubric-navigation-button ${activeView === 'manage'
                                            ? 'rubric-navigation-button-active'
                                            : 'rubric-navigation-button-inactive'
                                            }`}
                                    >
                                        <FileText className="rubric-icon-small" />
                                        Manage
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="rubric-content-area">
                            <div className="rubric-view-container">
                                {/* <p className="text-gray-600">
                                    Current view: <strong>{activeView}</strong>
                                </p> */}

                                {activeView === 'upload' && (
                                    <div className="mt-8 space-y-6">
                                        {/* <div className="text-center">
                                            <h3 className="text-lg font-medium mb-2">Upload Rubric Files</h3>
                                            <p className="text-gray-600 mb-4">
                                                Upload PDF, DOCX, or TXT files. Try a simple .txt file first to test.
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={handleTestBackend}
                                                className="mb-4"
                                            >
                                                Test Backend Connection
                                            </Button>
                                        </div> */}

                                        <div className="max-w-2xl mx-auto">
                                            <FileUploadDropzone
                                                onFileUpload={handleFileUpload}
                                                maxFileSize={10}
                                                acceptedFormats={['.pdf', '.docx', '.txt']}
                                                disabled={loadingState.uploading}
                                                onError={handleError}
                                                onSuccess={handleSuccess}
                                            />

                                            {/* Upload Progress */}
                                            {fileUploadState.status === 'uploading' && (
                                                <div className="mt-4">
                                                    <LoadingSpinner
                                                        size="md"
                                                        text={`Uploading... ${fileUploadState.progress}%`}
                                                        variant="inline"
                                                    />
                                                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                                                        <div
                                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${fileUploadState.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {fileUploadState.status === 'processing' && (
                                                <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                                                    <LoadingSpinner
                                                        size="md"
                                                        text="Processing rubric content..."
                                                        variant="inline"
                                                    />
                                                </div>
                                            )}

                                            {fileUploadState.status === 'error' && fileUploadState.error && (
                                                <div className="mt-4 p-4 bg-red-50 rounded-lg">
                                                    <div className="text-sm text-red-800">
                                                        Error: {fileUploadState.error}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeView === 'manage' && (
                                    <div className="mt-8 space-y-6">
                                        <div className="text-center">
                                            <h3 className="text-lg font-medium mb-2">Manage Rubrics</h3>
                                            <p className="text-gray-600 mb-4">
                                                Testing RubricGrid component with {rubrics.length} rubrics
                                            </p>
                                        </div>

                                        {rubrics.length > 0 ? (
                                            <LoadingState
                                                isLoading={loadingState.rubrics}
                                                fallback={<LoadingSpinner text="Loading rubrics..." />}
                                            >
                                                <RubricGrid
                                                    rubrics={rubrics}
                                                    courses={courses}
                                                    assignments={assignments}
                                                    onView={handleViewRubric}
                                                    onEdit={handleEditRubric}
                                                    onDelete={handleDeleteRubric}
                                                    loading={loadingState.rubrics}
                                                />
                                            </LoadingState>
                                        ) : (
                                            <LoadingState
                                                isLoading={loadingState.rubrics}
                                                fallback={<LoadingSpinner text="Loading rubrics..." />}
                                            >
                                                <div className="p-8 border border-gray-200 rounded-lg text-center">
                                                    <FileText className="size-12 text-gray-400 mx-auto mb-4" />
                                                    <h4 className="text-lg font-medium mb-2">No Rubrics Found</h4>
                                                    <p className="text-gray-600">
                                                        Upload or create rubrics to get started.
                                                    </p>
                                                </div>
                                            </LoadingState>
                                        )}
                                    </div>
                                )}

                                {activeView === 'create' && (
                                    <CreateRubricView
                                        onSuccess={handleSuccess}
                                        onError={handleError}
                                        onCancel={() => setActiveView('manage')}
                                        isSubmitting={loadingState.creating}
                                        hookData={hookData}
                                    />
                                )}

                                {activeView === 'view' && selectedRubric && (
                                    <ViewRubricView
                                        rubric={hookData?.rubrics?.find(r => r.id === selectedRubric.id) || selectedRubric}
                                        onBack={handleBackToManage}
                                        onEdit={() => handleEditRubric(selectedRubric)}
                                    />
                                )}

                                {activeView === 'edit' && selectedRubric && (
                                    <EditRubricView
                                        key={editSessionKey}
                                        rubric={selectedRubric}
                                        onSuccess={(message, updatedRubric) => {
                                            handleSuccess(message);
                                            if (updatedRubric) {
                                                setSelectedRubric(updatedRubric);
                                            }
                                            handleBackToManage();
                                        }}
                                        onError={handleError}
                                        onCancel={handleBackToManage}
                                        isSubmitting={loadingState.updating}
                                        hookData={hookData}
                                    />
                                )}

                                {/* <div className="mt-8 p-4 bg-white rounded border text-left">
                                    <h2 className="text-lg font-medium mb-2">Debug Info</h2>
                                    <ul className="text-sm space-y-1">
                                        <li>Component loaded: ✅</li>
                                        <li>Sidebar collapsed: {sidebarCollapsed ? 'Yes' : 'No'}</li>
                                        <li>Active view: <span className="font-bold text-blue-600">{activeView}</span></li>
                                        <li>Upload button active: {activeView === 'upload' ? '✅' : '❌'}</li>
                                        <li>Manage button active: {activeView === 'manage' ? '✅' : '❌'}</li>
                                        <li>Create button active: {activeView === 'create' ? '✅' : '❌'}</li>
                                        <li>Props received: {JSON.stringify({ courseId })}</li>
                                        <li>Hook initialized: {hookData ? '✅' : '❌'}</li>
                                        {hookData && (
                                            <>
                                                <li>Rubrics count: {hookData.rubrics?.length || 0}</li>
                                                <li>Loading state: {JSON.stringify(hookData.loadingState)}</li>
                                            </>
                                        )}
                                    </ul>
                                </div> */}
                            </div>
                        </div>
                    </div>
                </div>
            </ErrorBoundary>
        );
    } catch (error) {
        console.error('Error in RubricUploadPage render:', error);
        return (
            <div className="bg-red-50 min-h-screen p-8">
                <h1 className="text-2xl font-semibold mb-4 text-red-800">Error in RubricUploadPage</h1>
                <p className="text-red-600">
                    {error instanceof Error ? error.message : 'Unknown error occurred'}
                </p>
            </div>
        );
    }
}

// CreateRubricView Component
interface CreateRubricViewProps {
    onSuccess: (message: string) => void;
    onError: (error: string) => void;
    onCancel: () => void;
    isSubmitting: boolean;
    hookData: any;
}

interface RubricQuestion {
    id: string;
    title: string;
    description: string;
    minScore: number;
    maxScore: number;
    modelAnswer?: string;
    criteria: RubricCriterion[];
    scoringCriteria?: ScoringCriterion[]; // legacy flat format, kept for backward compat
}

interface ScoringCriterion {
    id: string;
    scoreRange: string;
    description: string;
    minPoints: number;
    maxPoints: number;
}

function CreateRubricView({ onSuccess, onError, onCancel, isSubmitting, hookData }: CreateRubricViewProps) {
    const [rubricTitle, setRubricTitle] = useState('');
    const [rubricDescription, setRubricDescription] = useState('');
    const [questions, setQuestions] = useState<RubricQuestion[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [lectureNotes, setLectureNotes] = useState<LectureNote[]>([]);

    // Add a new question
    const addQuestion = () => {
        const newQuestion: RubricQuestion = {
            id: `q-${Date.now()}`,
            title: '',
            description: '',
            minScore: 0,
            maxScore: 10,
            modelAnswer: '',
            criteria: []
        };
        setQuestions([...questions, newQuestion]);
    };

    // Update question
    const updateQuestion = (questionId: string, updates: Partial<RubricQuestion>) => {
        setQuestions(questions.map(q =>
            q.id === questionId ? { ...q, ...updates } : q
        ));
    };

    // Remove question
    const removeQuestion = (questionId: string) => {
        setQuestions(questions.filter(q => q.id !== questionId));
    };

    // Add scoring criterion to a question (flat mode — no named criteria)
    const addScoringCriterion = (questionId: string) => {
        const newCriterion: ScoringCriterion = {
            id: `c-${Date.now()}`,
            scoreRange: '',
            description: '',
            minPoints: 0,
            maxPoints: 0
        };

        setQuestions(questions.map(q =>
            q.id === questionId
                ? { ...q, scoringCriteria: [...(q.scoringCriteria ?? []), newCriterion] }
                : q
        ));
    };

    // Update scoring criterion (flat mode)
    const updateScoringCriterion = (questionId: string, criterionId: string, updates: Partial<ScoringCriterion>) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    scoringCriteria: (q.scoringCriteria ?? []).map(c =>
                        c.id === criterionId ? { ...c, ...updates } : c
                    )
                }
                : q
        ));
    };

    // Remove scoring criterion (flat mode)
    const removeScoringCriterion = (questionId: string, criterionId: string) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    scoringCriteria: (q.scoringCriteria ?? []).filter(c => c.id !== criterionId)
                }
                : q
        ));
    };

    // Add a named criterion to a question (criteria mode)
    const addCriterion = (questionId: string) => {
        const newCriterion: RubricCriterion = {
            id: `crit-${Date.now()}`,
            name: '',
            scoreLevels: []
        };
        setQuestions(questions.map(q =>
            q.id === questionId
                ? { ...q, criteria: [...q.criteria, newCriterion] }
                : q
        ));
    };

    // Update a named criterion's fields (e.g. name)
    const updateCriterion = (questionId: string, criterionId: string, updates: Partial<RubricCriterion>) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    criteria: q.criteria.map(c =>
                        c.id === criterionId ? { ...c, ...updates } : c
                    )
                }
                : q
        ));
    };

    // Remove a named criterion and all its score levels
    const removeCriterion = (questionId: string, criterionId: string) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? { ...q, criteria: q.criteria.filter(c => c.id !== criterionId) }
                : q
        ));
    };

    // Add a score level under a named criterion
    const addScoreLevel = (questionId: string, criterionId: string) => {
        const newLevel: ScoreLevel = {
            id: `sl-${Date.now()}`,
            scoreRange: '',
            description: '',
            minPoints: 0,
            maxPoints: 0
        };
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    criteria: q.criteria.map(c =>
                        c.id === criterionId
                            ? { ...c, scoreLevels: [...c.scoreLevels, newLevel] }
                            : c
                    )
                }
                : q
        ));
    };

    // Update a score level under a named criterion
    const updateScoreLevel = (questionId: string, criterionId: string, scoreLevelId: string, updates: Partial<ScoreLevel>) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    criteria: q.criteria.map(c =>
                        c.id === criterionId
                            ? {
                                ...c,
                                scoreLevels: c.scoreLevels.map(sl =>
                                    sl.id === scoreLevelId ? { ...sl, ...updates } : sl
                                )
                            }
                            : c
                    )
                }
                : q
        ));
    };

    // Remove a score level under a named criterion
    const removeScoreLevel = (questionId: string, criterionId: string, scoreLevelId: string) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    criteria: q.criteria.map(c =>
                        c.id === criterionId
                            ? { ...c, scoreLevels: c.scoreLevels.filter(sl => sl.id !== scoreLevelId) }
                            : c
                    )
                }
                : q
        ));
    };

    // Calculate total points
    const totalMinPoints = questions.reduce((sum, q) => sum + q.minScore, 0);
    const totalMaxPoints = questions.reduce((sum, q) => sum + q.maxScore, 0);

    // Validate form
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!rubricTitle.trim()) {
            newErrors.title = 'Rubric title is required';
        }

        if (questions.length === 0) {
            newErrors.questions = 'At least one question is required';
        }

        questions.forEach((question, index) => {
            if (!question.title.trim()) {
                newErrors[`question-${index}-title`] = 'Question title is required';
            }

            if (question.minScore < 0) {
                newErrors[`question-${index}-score`] = 'Minimum score cannot be negative';
            }

            if (question.maxScore <= question.minScore) {
                newErrors[`question-${index}-score`] = 'Maximum score must be greater than minimum score';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            onError('Please fix the validation errors before submitting');
            return;
        }

        try {
            // Create rubric data
            const rubricData = {
                title: rubricTitle,
                description: rubricDescription,
                questions: questions,
                totalMinPoints,
                totalMaxPoints,
                lectureNotes: lectureNotes
            };

            console.log('CreateRubricView: Submitting rubric data:', rubricData);

            // Use the hook's createRubric function with the form data
            if (hookData?.createRubric) {
                const success = await hookData.createRubric(rubricData);
                if (success) {
                    onSuccess('Rubric created successfully!');
                    // Reset form
                    setRubricTitle('');
                    setRubricDescription('');
                    setQuestions([]);
                    setErrors({});

                    // Refresh the rubrics list to show the new rubric
                    if (hookData?.refreshRubrics) {
                        console.log('CreateRubricView: Refreshing rubrics list...');
                        await hookData.refreshRubrics();
                    }

                    // Switch to manage view after a short delay
                    setTimeout(() => {
                        onCancel(); // This will switch back to manage view
                    }, 1000);
                } else {
                    onError('Failed to create rubric - check console for details');
                }
            } else {
                onError('Create function not available');
            }
        } catch (error) {
            console.error('CreateRubricView: Error creating rubric:', error);
            onError(error instanceof Error ? error.message : 'Failed to create rubric');
        }
    };

    return (
        <div className="rubric-create-container">
            <div className="rubric-create-card">
                <div className="rubric-create-header">
                    <h3 className="rubric-create-title">Create New Rubric</h3>
                    <p className="rubric-create-description">Build your custom grading rubric with questions and scoring criteria</p>
                </div>

                <form onSubmit={handleSubmit} className="rubric-form">
                    {/* Basic Information */}
                    <div className="rubric-form-section">
                        <div className="rubric-field-group">
                            <div className="rubric-field-label-row">
                                <label htmlFor="rubric-title" className="rubric-field-label">
                                    Rubric Title *
                                </label>
                                <div className="rubric-total-marks-display">
                                    Total: <span className="rubric-total-marks-value">{totalMinPoints} - {totalMaxPoints} marks</span>
                                </div>
                            </div>
                            <input
                                id="rubric-title"
                                type="text"
                                value={rubricTitle}
                                onChange={(e) => setRubricTitle(e.target.value)}
                                className={`rubric-text-input ${errors.title ? 'rubric-text-input-error' : ''}`}
                                placeholder="Enter rubric title..."
                                disabled={isSubmitting}
                            />
                            {errors.title && (
                                <p className="rubric-error-message">{errors.title}</p>
                            )}
                        </div>

                        <div className="rubric-field-group">
                            <label htmlFor="rubric-description" className="rubric-field-label">
                                Description
                            </label>
                            <textarea
                                id="rubric-description"
                                value={rubricDescription}
                                onChange={(e) => setRubricDescription(e.target.value)}
                                rows={3}
                                className="rubric-text-area"
                                placeholder="Describe the purpose and scope of this rubric..."
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Lecture Notes Section */}
                    <div className="rubric-form-section">
                        <LectureNotesSection
                            onNotesChange={setLectureNotes}
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Questions Section */}
                    <div className="rubric-questions-section">
                        <div className="rubric-questions-section-header">
                            <h4 className="rubric-section-title">Questions</h4>
                        </div>

                        {errors.questions && (
                            <p className="rubric-error-message">{errors.questions}</p>
                        )}

                        {questions.length === 0 ? (
                            <div className="rubric-empty-state">
                                <FileText className="rubric-empty-state-icon" />
                                <p>No questions added yet</p>
                                <p className="text-sm">Click "Add Question" to get started</p>
                            </div>
                        ) : (
                            <div className="rubric-questions-list">
                                {questions.map((question, index) => (
                                    <QuestionEditor
                                        key={question.id}
                                        question={question}
                                        index={index}
                                        onUpdate={(updates) => updateQuestion(question.id, updates)}
                                        onRemove={() => removeQuestion(question.id)}
                                        onAddCriterion={() => addScoringCriterion(question.id)}
                                        onUpdateCriterion={(criterionId, updates) =>
                                            updateScoringCriterion(question.id, criterionId, updates)
                                        }
                                        onRemoveCriterion={(criterionId) =>
                                            removeScoringCriterion(question.id, criterionId)
                                        }
                                        onAddNamedCriterion={() => addCriterion(question.id)}
                                        onUpdateNamedCriterion={(criterionId, updates) =>
                                            updateCriterion(question.id, criterionId, updates)
                                        }
                                        onRemoveNamedCriterion={(criterionId) =>
                                            removeCriterion(question.id, criterionId)
                                        }
                                        onAddScoreLevel={(criterionId) =>
                                            addScoreLevel(question.id, criterionId)
                                        }
                                        onUpdateScoreLevel={(criterionId, scoreLevelId, updates) =>
                                            updateScoreLevel(question.id, criterionId, scoreLevelId, updates)
                                        }
                                        onRemoveScoreLevel={(criterionId, scoreLevelId) =>
                                            removeScoreLevel(question.id, criterionId, scoreLevelId)
                                        }
                                        errors={errors}
                                        disabled={isSubmitting}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="mt-4">
                            <Button
                                type="button"
                                onClick={addQuestion}
                                variant="default"
                                size="sm"
                                disabled={isSubmitting}
                            >
                                <Plus className="rubric-button-icon" />
                                Add Question
                            </Button>
                        </div>
                    </div>

                    {/* Form Actions */}
                    <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                        <Button
                            type="button"
                            onClick={onCancel}
                            variant="outline"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="default"
                            disabled={isSubmitting || !rubricTitle.trim() || questions.length === 0}
                        >
                            {isSubmitting ? (
                                <>
                                    <LoadingSpinner size="sm" variant="inline" />
                                    Creating...
                                </>
                            ) : (
                                'Create Rubric'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// QuestionEditor Component
interface QuestionEditorProps {
    question: RubricQuestion;
    index: number;
    onUpdate: (updates: Partial<RubricQuestion>) => void;
    onRemove: () => void;
    onAddCriterion: () => void;
    onUpdateCriterion: (criterionId: string, updates: Partial<ScoringCriterion>) => void;
    onRemoveCriterion: (criterionId: string) => void;
    // New criteria-mode handlers
    onAddNamedCriterion: () => void;
    onUpdateNamedCriterion: (criterionId: string, updates: Partial<RubricCriterion>) => void;
    onRemoveNamedCriterion: (criterionId: string) => void;
    onAddScoreLevel: (criterionId: string) => void;
    onUpdateScoreLevel: (criterionId: string, scoreLevelId: string, updates: Partial<ScoreLevel>) => void;
    onRemoveScoreLevel: (criterionId: string, scoreLevelId: string) => void;
    errors: Record<string, string>;
    disabled: boolean;
}

function QuestionEditor({
    question,
    index,
    onUpdate,
    onRemove,
    onAddCriterion,
    onUpdateCriterion,
    onRemoveCriterion,
    onAddNamedCriterion,
    onUpdateNamedCriterion,
    onRemoveNamedCriterion,
    onAddScoreLevel,
    onUpdateScoreLevel,
    onRemoveScoreLevel,
    errors,
    disabled
}: QuestionEditorProps) {
    return (
        <div className="rubric-question-block">
            <div className="rubric-question-header">
                <h5 className="rubric-question-title">Question {index + 1}</h5>
                <Button
                    type="button"
                    onClick={onRemove}
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                >
                    <Trash2 className="rubric-button-icon" />
                </Button>
            </div>

            <div className="space-y-4">
                {/* Question Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Question Title *
                    </label>
                    <input
                        type="text"
                        value={question.title}
                        onChange={(e) => onUpdate({ title: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${errors[`question-${index}-title`] ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder="Enter question title..."
                        disabled={disabled}
                    />
                    {errors[`question-${index}-title`] && (
                        <p className="mt-1 text-sm text-red-600">{errors[`question-${index}-title`]}</p>
                    )}
                </div>

                {/* Question Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description/ Context (Optional)
                    </label>
                    <textarea
                        value={question.description || ''}
                        onChange={(e) => onUpdate({ description: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Describe what this question evaluates..."
                        disabled={disabled}
                    />
                </div>

                {/* Score Range */}
                <div className="flex items-end gap-4">
                    <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Min Score *
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={question.minScore}
                            onChange={(e) => onUpdate({ minScore: parseFloat(e.target.value) || 0 })}
                            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${errors[`question-${index}-score`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                            disabled={disabled}
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Max Score *
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={question.maxScore}
                            onChange={(e) => onUpdate({ maxScore: parseFloat(e.target.value) || 0 })}
                            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${errors[`question-${index}-score`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                            disabled={disabled}
                        />
                    </div>
                </div>
                {errors[`question-${index}-score`] && (
                    <p className="text-sm text-red-600">{errors[`question-${index}-score`]}</p>
                )}

                {/* Model Answer */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Model Answer (Optional)
                    </label>
                    <textarea
                        value={question.modelAnswer || ''}
                        onChange={(e) => onUpdate({ modelAnswer: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Provide a model answer or key points for this question..."
                        disabled={disabled}
                    />
                </div>

                {/* Scoring Section — criteria mode or flat mode */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Scoring Criteria
                        </label>
                    </div>

                    {/* Criteria mode: named criteria with nested score levels */}
                    {question.criteria.length > 0 ? (
                        <div className="space-y-3">
                            {question.criteria.map((criterion) => (
                                <CriterionEditor
                                    key={criterion.id}
                                    criterion={criterion}
                                    onUpdateCriterion={(updates) => onUpdateNamedCriterion(criterion.id, updates)}
                                    onRemoveCriterion={() => onRemoveNamedCriterion(criterion.id)}
                                    onAddScoreLevel={() => onAddScoreLevel(criterion.id)}
                                    onUpdateScoreLevel={(scoreLevelId, updates) =>
                                        onUpdateScoreLevel(criterion.id, scoreLevelId, updates)
                                    }
                                    onRemoveScoreLevel={(scoreLevelId) =>
                                        onRemoveScoreLevel(criterion.id, scoreLevelId)
                                    }
                                    disabled={disabled}
                                />
                            ))}
                            <Button
                                type="button"
                                onClick={onAddNamedCriterion}
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                            >
                                <Plus className="size-4" />
                                Add Criterion
                            </Button>
                        </div>
                    ) : (
                        /* Flat mode: score levels directly on the question */
                        <div className="space-y-2">
                            {(question.scoringCriteria ?? []).map((criterion) => (
                                <ScoringCriterionEditor
                                    key={criterion.id}
                                    criterion={criterion}
                                    onUpdate={(updates) => onUpdateCriterion(criterion.id, updates)}
                                    onRemove={() => onRemoveCriterion(criterion.id)}
                                    disabled={disabled}
                                />
                            ))}

                            {(question.scoringCriteria ?? []).length === 0 ? (
                                <div className="text-left py-4 px-3 text-gray-500 border-2 border-dashed border-gray-300 rounded-md">
                                    <p className="text-sm">No scoring criteria added</p>
                                    <p className="text-xs">Use "Add Score Level" for simple scoring, or "Add Criterion" for multi-dimensional scoring</p>
                                </div>
                            ) : null}
                            <div className="flex gap-2 mt-2">
                                <Button
                                    type="button"
                                    onClick={onAddCriterion}
                                    variant="outline"
                                    size="sm"
                                    disabled={disabled}
                                    style={{ backgroundColor: '#f3f4f6', color: '#202021ff', borderColor: '#e5e7eb' }}
                                >
                                    <Plus className="size-4" />
                                    Add Score Level
                                </Button>
                                <Button
                                    type="button"
                                    onClick={onAddNamedCriterion}
                                    variant="outline"
                                    size="sm"
                                    disabled={disabled}
                                >
                                    <Plus className="size-4" />
                                    Add Criterion
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ScoringCriterionEditor Component
interface ScoringCriterionEditorProps {
    criterion: ScoringCriterion;
    onUpdate: (updates: Partial<ScoringCriterion>) => void;
    onRemove: () => void;
    disabled: boolean;
}

function ScoringCriterionEditor({
    criterion,
    onUpdate,
    onRemove,
    disabled
}: ScoringCriterionEditorProps) {
    const handleScoreRangeChange = (value: string) => {
        onUpdate({ scoreRange: value });

        // Parse score range and update min/max points
        if (value.includes('-')) {
            const [min, max] = value.split('-').map(s => parseFloat(s.trim()));
            if (!isNaN(min) && !isNaN(max)) {
                onUpdate({
                    scoreRange: value,
                    minPoints: min,
                    maxPoints: max
                });
            }
        } else {
            const score = parseFloat(value);
            if (!isNaN(score)) {
                onUpdate({
                    scoreRange: value,
                    minPoints: score,
                    maxPoints: score
                });
            }
        }
    };

    return (
        <div className="rubric-criterion-block">
            <div className="rubric-criterion-inputs">
                <div className="rubric-criterion-input-group">
                    <input
                        type="text"
                        value={criterion.scoreRange}
                        onChange={(e) => handleScoreRangeChange(e.target.value)}
                        className="rubric-criterion-input"
                        placeholder="e.g., 8-10, 5"
                        disabled={disabled}
                    />
                    <p className="rubric-criterion-input-label">Score range</p>
                </div>
                <div className="rubric-criterion-input-group">
                    <input
                        type="text"
                        value={criterion.description}
                        onChange={(e) => onUpdate({ description: e.target.value })}
                        className="rubric-criterion-input"
                        placeholder="Description of this score level..."
                        disabled={disabled}
                    />
                    <p className="rubric-criterion-input-label">Criteria description</p>
                </div>
            </div>
            <Button
                type="button"
                onClick={onRemove}
                variant="ghost"
                size="sm"
                disabled={disabled}
            >
                <X className="rubric-button-icon" />
            </Button>
        </div>
    );
}

// ScoreLevelEditor Component — mirrors ScoringCriterionEditor but typed for ScoreLevel
interface ScoreLevelEditorProps {
    scoreLevel: ScoreLevel;
    onUpdate: (updates: Partial<ScoreLevel>) => void;
    onRemove: () => void;
    disabled: boolean;
}

function ScoreLevelEditor({ scoreLevel, onUpdate, onRemove, disabled }: ScoreLevelEditorProps) {
    const handleScoreRangeChange = (value: string) => {
        if (value.includes('-')) {
            const [min, max] = value.split('-').map(s => parseFloat(s.trim()));
            if (!isNaN(min) && !isNaN(max)) {
                onUpdate({ scoreRange: value, minPoints: min, maxPoints: max });
                return;
            }
        } else {
            const score = parseFloat(value);
            if (!isNaN(score)) {
                onUpdate({ scoreRange: value, minPoints: score, maxPoints: score });
                return;
            }
        }
        onUpdate({ scoreRange: value });
    };

    return (
        <div className="rubric-criterion-block">
            <div className="rubric-criterion-inputs">
                <div className="rubric-criterion-input-group">
                    <input
                        type="text"
                        value={scoreLevel.scoreRange}
                        onChange={(e) => handleScoreRangeChange(e.target.value)}
                        className="rubric-criterion-input"
                        placeholder="e.g., 8-10, 5"
                        disabled={disabled}
                    />
                    <p className="rubric-criterion-input-label">Score range</p>
                </div>
                <div className="rubric-criterion-input-group">
                    <input
                        type="text"
                        value={scoreLevel.description}
                        onChange={(e) => onUpdate({ description: e.target.value })}
                        className="rubric-criterion-input"
                        placeholder="Description of this score level..."
                        disabled={disabled}
                    />
                    <p className="rubric-criterion-input-label">Score level description</p>
                </div>
            </div>
            <Button type="button" onClick={onRemove} variant="ghost" size="sm" disabled={disabled}>
                <X className="rubric-button-icon" />
            </Button>
        </div>
    );
}

// CriterionEditor Component — renders a named criterion with nested ScoreLevelEditor rows
interface CriterionEditorProps {
    criterion: RubricCriterion;
    onUpdateCriterion: (updates: Partial<RubricCriterion>) => void;
    onRemoveCriterion: () => void;
    onAddScoreLevel: () => void;
    onUpdateScoreLevel: (scoreLevelId: string, updates: Partial<ScoreLevel>) => void;
    onRemoveScoreLevel: (scoreLevelId: string) => void;
    disabled: boolean;
}

function CriterionEditor({
    criterion,
    onUpdateCriterion,
    onRemoveCriterion,
    onAddScoreLevel,
    onUpdateScoreLevel,
    onRemoveScoreLevel,
    disabled
}: CriterionEditorProps) {
    return (
        <div className="rubric-question-block" style={{ marginBottom: '0.75rem' }}>
            {/* Criterion header: name input + remove button */}
            <div className="rubric-question-header" style={{ marginBottom: '0.5rem' }}>
                <input
                    type="text"
                    value={criterion.name}
                    onChange={(e) => onUpdateCriterion({ name: e.target.value })}
                    className="rubric-text-input"
                    placeholder="Criterion name (e.g. Content, Clarity)..."
                    disabled={disabled}
                    style={{ flex: 1, marginRight: '0.5rem' }}
                />
                <Button type="button" onClick={onRemoveCriterion} variant="ghost" size="sm" disabled={disabled}>
                    <Trash2 className="rubric-button-icon" />
                </Button>
            </div>

            {/* Score levels list */}
            <div className="space-y-2" style={{ paddingLeft: '0.75rem', borderLeft: '2px solid #e5e7eb' }}>
                {criterion.scoreLevels.length === 0 ? (
                    <div className="text-left py-3 text-gray-500 border-2 border-dashed border-gray-200 rounded-md px-3">
                        <p className="text-sm">No score levels yet</p>
                        <p className="text-xs">Click "Add Score Level" to define score descriptors for this criterion</p>
                    </div>
                ) : (
                    criterion.scoreLevels.map((sl) => (
                        <ScoreLevelEditor
                            key={sl.id}
                            scoreLevel={sl}
                            onUpdate={(updates) => onUpdateScoreLevel(sl.id, updates)}
                            onRemove={() => onRemoveScoreLevel(sl.id)}
                            disabled={disabled}
                        />
                    ))
                )}

                <Button
                    type="button"
                    onClick={onAddScoreLevel}
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    style={{ marginTop: '0.25rem', backgroundColor: '#f3f4f6', color: '#515151ff', borderColor: '#e5e7eb' }}
                >
                    <Plus className="size-4" />
                    Add Score Level
                </Button>
            </div>
        </div>
    );
}

// ViewRubricView Component
interface ViewRubricViewProps {
    rubric: RubricData;
    onBack: () => void;
    onEdit: () => void;
}

function ViewRubricView({ rubric, onBack, onEdit }: ViewRubricViewProps) {
    const totalMinPoints = rubric.questions.reduce((sum: number, q: any) => sum + q.minScore, 0);
    const totalMaxPoints = rubric.questions.reduce((sum: number, q: any) => sum + q.maxScore, 0);

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    };

    return (
        <div className="rubric-create-container">
            <div className="rubric-create-card">
                <div className="rubric-create-header">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="rubric-create-title">View Rubric</h3>
                            <p className="rubric-create-description">Detailed view of rubric content</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={onEdit}
                                variant="default"
                                size="sm"
                            >
                                <Edit className="rubric-button-icon" />
                                Edit
                            </Button>
                            <Button
                                type="button"
                                onClick={onBack}
                                variant="outline"
                                size="sm"
                            >
                                <X className="rubric-button-icon" />
                                Back
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="rubric-form">
                    {/* Basic Information */}
                    <div className="rubric-form-section">
                        <div className="rubric-field-group">
                            <div className="rubric-field-label-row">
                                <label className="rubric-field-label">
                                    Rubric Title
                                </label>
                                <div className="rubric-total-marks-display">
                                    Total: <span className="rubric-total-marks-value">{totalMinPoints} - {totalMaxPoints} marks</span>
                                </div>
                            </div>
                            <div className="rubric-text-input-readonly">
                                {rubric.title}
                            </div>
                        </div>

                        <div className="rubric-field-group">
                            <label className="rubric-field-label">
                                Description
                            </label>
                            <div className="rubric-text-area-readonly">
                                {rubric.description || 'No description provided'}
                            </div>
                        </div>

                        {/* Lecture Notes Display */}
                        {rubric.lectureNotes && rubric.lectureNotes.length > 0 && (
                            <div className="rubric-field-group">
                                <LectureNotesDisplay notes={rubric.lectureNotes} />
                            </div>
                        )}

                        <div className="rubric-field-group">
                            <label className="rubric-field-label">
                                Created
                            </label>
                            <div className="rubric-text-input-readonly">
                                {formatDate(rubric.createdAt)}
                            </div>
                        </div>

                        {rubric.updatedAt && rubric.updatedAt !== rubric.createdAt && (
                            <div className="rubric-field-group">
                                <label className="rubric-field-label">
                                    Last Updated
                                </label>
                                <div className="rubric-text-input-readonly">
                                    {formatDate(rubric.updatedAt)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Questions Section */}
                    <div className="rubric-questions-section">
                        <div className="rubric-questions-section-header">
                            <h4 className="rubric-section-title">Questions ({rubric.questions.length})</h4>
                        </div>

                        {rubric.questions.length === 0 ? (
                            <div className="rubric-empty-state">
                                <FileText className="rubric-empty-state-icon" />
                                <p>No questions in this rubric</p>
                            </div>
                        ) : (
                            <div className="rubric-questions-list">
                                {rubric.questions.map((question, index) => (
                                    <ViewQuestionDisplay
                                        key={question.id}
                                        question={question}
                                        index={index}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ViewQuestionDisplay Component
interface ViewQuestionDisplayProps {
    question: any;
    index: number;
}

function ViewQuestionDisplay({ question, index }: ViewQuestionDisplayProps) {
    // Migrate legacy flat scoringCriteria on the fly for display
    const migrated = migrateLegacyQuestion({
        ...question,
        criteria: question.criteria ?? []
    });

    return (
        <div className="rubric-question-block">
            <div className="rubric-question-header">
                <h5 className="rubric-question-title">Question {index + 1}</h5>
                <div className="rubric-question-points">
                    {question.minScore} - {question.maxScore} points
                </div>
            </div>

            <div className="rubric-question-content">
                <div className="rubric-field-group">
                    <label className="rubric-field-label">Title</label>
                    <div className="rubric-text-input-readonly">
                        {question.title}
                    </div>
                </div>

                {question.description && (
                    <div className="rubric-field-group">
                        <label className="rubric-field-label">Description</label>
                        <div className="rubric-text-area-readonly">
                            {question.description}
                        </div>
                    </div>
                )}

                {question.modelAnswer && (
                    <div className="rubric-field-group">
                        <label className="rubric-field-label">Model Answer</label>
                        <div className="rubric-text-area-readonly">
                            {question.modelAnswer}
                        </div>
                    </div>
                )}

                {/* Criteria mode: named criteria as sub-headings with nested score levels */}
                {migrated.criteria.length > 0 ? (
                    <div className="rubric-field-group">
                        <label className="rubric-field-label">Scoring Criteria</label>
                        <div className="space-y-3">
                            {migrated.criteria.map((criterion) => (
                                <div key={criterion.id} className="rubric-question-block" style={{ marginBottom: 0 }}>
                                    <div className="rubric-question-header" style={{ marginBottom: '0.5rem' }}>
                                        <span className="text-sm font-semibold text-gray-700">{criterion.name || 'Unnamed Criterion'}</span>
                                    </div>
                                    <div className="space-y-2" style={{ paddingLeft: '0.75rem', borderLeft: '2px solid #e5e7eb' }}>
                                        {criterion.scoreLevels.length === 0 ? (
                                            <p className="text-sm text-gray-400">No score levels defined</p>
                                        ) : (
                                            criterion.scoreLevels.map((sl) => (
                                                <div key={sl.id} className="rubric-criterion-display">
                                                    <div className="rubric-criterion-score">{sl.scoreRange} points</div>
                                                    <div className="rubric-criterion-description">{sl.description}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (question.scoringCriteria ?? []).length > 0 && (
                    /* Flat mode: score levels rendered directly (no named criteria) */
                    <div className="rubric-field-group">
                        <label className="rubric-field-label">Scoring Criteria</label>
                        <div className="space-y-2">
                            {(question.scoringCriteria ?? []).map((criterion: any) => (
                                <div key={criterion.id} className="rubric-criterion-display">
                                    <div className="rubric-criterion-score">
                                        {criterion.scoreRange} points
                                    </div>
                                    <div className="rubric-criterion-description">
                                        {criterion.description}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Migration utility: wraps legacy flat scoringCriteria into a single named criterion
function migrateLegacyQuestion(q: RubricQuestion): RubricQuestion {
    if (q.criteria && q.criteria.length > 0) return q; // already new format
    if (!q.scoringCriteria || q.scoringCriteria.length === 0) {
        return { ...q, criteria: [] };
    }
    return {
        ...q,
        criteria: [{
            id: `crit-migrated-${q.id}`,
            name: 'Scoring Criteria',
            scoreLevels: q.scoringCriteria.map(c => ({
                id: c.id,
                scoreRange: c.scoreRange,
                description: c.description,
                minPoints: c.minPoints,
                maxPoints: c.maxPoints
            }))
        }]
    };
}

// EditRubricView Component
interface EditRubricViewProps {
    rubric: RubricData;
    onSuccess: (message: string, updatedRubric?: RubricData) => void;
    onError: (error: string) => void;
    onCancel: () => void;
    isSubmitting: boolean;
    hookData: any;
}

function EditRubricView({ rubric, onSuccess, onError, onCancel, isSubmitting, hookData }: EditRubricViewProps) {
    const [rubricTitle, setRubricTitle] = useState(rubric.title);
    const [rubricDescription, setRubricDescription] = useState(rubric.description);
    const [lectureNotes, setLectureNotes] = useState<LectureNote[]>(rubric.lectureNotes || []);
    // Capture initial notes once so LectureNotesSection doesn't get a moving target as initialNotes
    const initialNotesRef = useRef<LectureNote[]>(rubric.lectureNotes || []);
    const [questions, setQuestions] = useState<RubricQuestion[]>(
        rubric.questions.map(q => migrateLegacyQuestion({
            ...q,
            description: q.description || '',
            criteria: (q as any).criteria ?? []
        }))
    );
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Add a new question
    const addQuestion = () => {
        const newQuestion: RubricQuestion = {
            id: `q-${Date.now()}`,
            title: '',
            description: '',
            minScore: 0,
            maxScore: 10,
            modelAnswer: '',
            criteria: []
        };
        setQuestions([...questions, newQuestion]);
    };

    // Update question
    const updateQuestion = (questionId: string, updates: Partial<RubricQuestion>) => {
        setQuestions(questions.map(q =>
            q.id === questionId ? { ...q, ...updates } : q
        ));
    };

    // Remove question
    const removeQuestion = (questionId: string) => {
        setQuestions(questions.filter(q => q.id !== questionId));
    };

    // Add scoring criterion to a question (flat mode — no named criteria)
    const addScoringCriterion = (questionId: string) => {
        const newCriterion: ScoringCriterion = {
            id: `c-${Date.now()}`,
            scoreRange: '',
            description: '',
            minPoints: 0,
            maxPoints: 0
        };

        setQuestions(questions.map(q =>
            q.id === questionId
                ? { ...q, scoringCriteria: [...(q.scoringCriteria ?? []), newCriterion] }
                : q
        ));
    };

    // Update scoring criterion (flat mode)
    const updateScoringCriterion = (questionId: string, criterionId: string, updates: Partial<ScoringCriterion>) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    scoringCriteria: (q.scoringCriteria ?? []).map(c =>
                        c.id === criterionId ? { ...c, ...updates } : c
                    )
                }
                : q
        ));
    };

    // Remove scoring criterion (flat mode)
    const removeScoringCriterion = (questionId: string, criterionId: string) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    scoringCriteria: (q.scoringCriteria ?? []).filter(c => c.id !== criterionId)
                }
                : q
        ));
    };

    // Add a named criterion to a question (criteria mode)
    const addCriterion = (questionId: string) => {
        const newCriterion: RubricCriterion = {
            id: `crit-${Date.now()}`,
            name: '',
            scoreLevels: []
        };
        setQuestions(questions.map(q =>
            q.id === questionId
                ? { ...q, criteria: [...(q.criteria ?? []), newCriterion] }
                : q
        ));
    };

    // Update a named criterion's fields (e.g. name)
    const updateCriterion = (questionId: string, criterionId: string, updates: Partial<RubricCriterion>) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    criteria: (q.criteria ?? []).map(c =>
                        c.id === criterionId ? { ...c, ...updates } : c
                    )
                }
                : q
        ));
    };

    // Remove a named criterion and all its score levels
    const removeCriterion = (questionId: string, criterionId: string) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? { ...q, criteria: (q.criteria ?? []).filter(c => c.id !== criterionId) }
                : q
        ));
    };

    // Add a score level under a named criterion
    const addScoreLevel = (questionId: string, criterionId: string) => {
        const newLevel: ScoreLevel = {
            id: `sl-${Date.now()}`,
            scoreRange: '',
            description: '',
            minPoints: 0,
            maxPoints: 0
        };
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    criteria: (q.criteria ?? []).map(c =>
                        c.id === criterionId
                            ? { ...c, scoreLevels: [...c.scoreLevels, newLevel] }
                            : c
                    )
                }
                : q
        ));
    };

    // Update a score level under a named criterion
    const updateScoreLevel = (questionId: string, criterionId: string, scoreLevelId: string, updates: Partial<ScoreLevel>) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    criteria: (q.criteria ?? []).map(c =>
                        c.id === criterionId
                            ? {
                                ...c,
                                scoreLevels: c.scoreLevels.map(sl =>
                                    sl.id === scoreLevelId ? { ...sl, ...updates } : sl
                                )
                            }
                            : c
                    )
                }
                : q
        ));
    };

    // Remove a score level under a named criterion
    const removeScoreLevel = (questionId: string, criterionId: string, scoreLevelId: string) => {
        setQuestions(questions.map(q =>
            q.id === questionId
                ? {
                    ...q,
                    criteria: (q.criteria ?? []).map(c =>
                        c.id === criterionId
                            ? { ...c, scoreLevels: c.scoreLevels.filter(sl => sl.id !== scoreLevelId) }
                            : c
                    )
                }
                : q
        ));
    };

    // Calculate total points
    const totalMinPoints = questions.reduce((sum, q) => sum + q.minScore, 0);
    const totalMaxPoints = questions.reduce((sum, q) => sum + q.maxScore, 0);

    // Validate form
    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!rubricTitle.trim()) {
            newErrors.title = 'Rubric title is required';
        }

        questions.forEach((question, index) => {
            if (!question.title.trim()) {
                newErrors[`question-${index}-title`] = 'Question title is required';
            }

            if (question.minScore < 0) {
                newErrors[`question-${index}-score`] = 'Minimum score cannot be negative';
            }

            if (question.maxScore <= question.minScore) {
                newErrors[`question-${index}-score`] = 'Maximum score must be greater than minimum score';
            }
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            console.log('Edit validation failed, questions:', questions.length, JSON.stringify(questions.map(q => ({ title: q.title, min: q.minScore, max: q.maxScore }))));
            onError('Please fix the validation errors before submitting');
            return;
        }

        try {
            // Create updated rubric data
            const updatedRubricData = {
                title: rubricTitle,
                description: rubricDescription,
                questions: questions,
                totalMinPoints,
                totalMaxPoints,
                lectureNotes: lectureNotes,
                updatedAt: new Date()
            };

            console.log('=== SUBMIT DEBUG ===');
            console.log('lectureNotes count:', lectureNotes.length);
            console.log('lectureNotes:', JSON.stringify(lectureNotes.map(n => ({ id: n.id, name: n.originalName }))));
            console.log('updatedRubricData:', updatedRubricData);

            // Use the hook's updateRubric function
            if (hookData?.updateRubric) {
                const success = await hookData.updateRubric(rubric.id, updatedRubricData);
                if (success) {
                    // Refresh first so the manage view shows updated data
                    if (hookData?.refreshRubrics) {
                        await hookData.refreshRubrics();
                    }
                    onSuccess('Rubric updated successfully!', { ...rubric, ...updatedRubricData } as RubricData);
                } else {
                    onError('Failed to update rubric - check console for details');
                }
            } else {
                onError('Update function not available');
            }
        } catch (error) {
            console.error('EditRubricView: Error updating rubric:', error);
            onError(error instanceof Error ? error.message : 'Failed to update rubric');
        }
    };

    return (
        <div className="rubric-create-container">
            <div className="rubric-create-card">
                <div className="rubric-create-header">
                    <h3 className="rubric-create-title">Edit Rubric</h3>
                    <p className="rubric-create-description">Modify your rubric content and scoring criteria</p>
                </div>

                <form onSubmit={handleSubmit} className="rubric-form">
                    {/* Basic Information */}
                    <div className="rubric-form-section">
                        <div className="rubric-field-group">
                            <div className="rubric-field-label-row">
                                <label htmlFor="rubric-title" className="rubric-field-label">
                                    Rubric Title *
                                </label>
                                <div className="rubric-total-marks-display">
                                    Total: <span className="rubric-total-marks-value">{totalMinPoints} - {totalMaxPoints} marks</span>
                                </div>
                            </div>
                            <input
                                id="rubric-title"
                                type="text"
                                value={rubricTitle}
                                onChange={(e) => setRubricTitle(e.target.value)}
                                className={`rubric-text-input ${errors.title ? 'rubric-text-input-error' : ''}`}
                                placeholder="Enter rubric title..."
                                disabled={isSubmitting}
                            />
                            {errors.title && (
                                <p className="rubric-error-message">{errors.title}</p>
                            )}
                        </div>

                        <div className="rubric-field-group">
                            <label htmlFor="rubric-description" className="rubric-field-label">
                                Description
                            </label>
                            <textarea
                                id="rubric-description"
                                value={rubricDescription}
                                onChange={(e) => setRubricDescription(e.target.value)}
                                rows={3}
                                className="rubric-text-area"
                                placeholder="Describe the purpose and scope of this rubric..."
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Lecture Notes Section */}
                    <div className="rubric-form-section">
                        <LectureNotesSection
                            onNotesChange={setLectureNotes}
                            initialNotes={initialNotesRef.current}
                            rubricId={rubric.id}
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Questions Section */}
                    <div className="rubric-questions-section">
                        <div className="rubric-questions-section-header">
                            <h4 className="rubric-section-title">Questions</h4>
                        </div>

                        {errors.questions && (
                            <p className="rubric-error-message">{errors.questions}</p>
                        )}

                        {questions.length === 0 ? (
                            <div className="rubric-empty-state">
                                <FileText className="rubric-empty-state-icon" />
                                <p>No questions added yet</p>
                                <p className="text-sm">Click "Add Question" to get started</p>
                            </div>
                        ) : (
                            <div className="rubric-questions-list">
                                {questions.map((question, index) => (
                                    <QuestionEditor
                                        key={question.id}
                                        question={question}
                                        index={index}
                                        onUpdate={(updates) => updateQuestion(question.id, updates)}
                                        onRemove={() => removeQuestion(question.id)}
                                        onAddCriterion={() => addScoringCriterion(question.id)}
                                        onUpdateCriterion={(criterionId, updates) => updateScoringCriterion(question.id, criterionId, updates)}
                                        onRemoveCriterion={(criterionId) => removeScoringCriterion(question.id, criterionId)}
                                        onAddNamedCriterion={() => addCriterion(question.id)}
                                        onUpdateNamedCriterion={(criterionId, updates) =>
                                            updateCriterion(question.id, criterionId, updates)
                                        }
                                        onRemoveNamedCriterion={(criterionId) =>
                                            removeCriterion(question.id, criterionId)
                                        }
                                        onAddScoreLevel={(criterionId) =>
                                            addScoreLevel(question.id, criterionId)
                                        }
                                        onUpdateScoreLevel={(criterionId, scoreLevelId, updates) =>
                                            updateScoreLevel(question.id, criterionId, scoreLevelId, updates)
                                        }
                                        onRemoveScoreLevel={(criterionId, scoreLevelId) =>
                                            removeScoreLevel(question.id, criterionId, scoreLevelId)
                                        }
                                        errors={errors}
                                        disabled={isSubmitting}
                                    />
                                ))}
                            </div>
                        )}
                        <div className="mt-4">
                            <Button
                                type="button"
                                onClick={addQuestion}
                                variant="default"
                                size="sm"
                                disabled={isSubmitting}
                            >
                                <Plus className="rubric-button-icon" />
                                Add Question
                            </Button>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="rubric-form-actions">
                        <Button
                            type="button"
                            onClick={onCancel}
                            variant="outline"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="default"
                            disabled={isSubmitting || !rubricTitle.trim()}
                        >
                            {isSubmitting ? (
                                <>
                                    <LoadingSpinner size="sm" variant="inline" />
                                    Updating...
                                </>
                            ) : (
                                'Update Rubric'
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
