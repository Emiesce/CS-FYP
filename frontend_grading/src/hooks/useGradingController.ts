import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { StudentModel } from '../models/StudentModel';
import { GradingSessionModel } from '../models/GradingSessionModel';
import { GradingService } from '../services/GradingService';
import { GradingSession } from '../types';

interface UseGradingControllerProps {
    courseId?: string;
    assignmentId?: string;
}

export const useGradingController = ({ courseId, assignmentId }: UseGradingControllerProps = {}) => {
    // Models
    const [studentModel, setStudentModel] = useState<StudentModel | null>(null);
    const [sessionModel, setSessionModel] = useState<GradingSessionModel | null>(null);

    // Services - Memoize to prevent recreation
    const gradingService = useMemo(() => new GradingService(), []);

    // UI State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRubric, setSelectedRubric] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Performance optimization - prevent unnecessary re-renders
    const [forceUpdate, setForceUpdate] = useState(0);

    // Initialize the controller
    useEffect(() => {
        const initializeController = async () => {
            try {
                setLoading(true);
                setError(null);

                // Fetch students from service
                const studentsResponse = await gradingService.getStudents(courseId, assignmentId);

                if (!studentsResponse.success) {
                    throw new Error(studentsResponse.message || 'Failed to load students');
                }

                // Initialize models
                const students = studentsResponse.data;
                const studentModelInstance = new StudentModel(students);

                const initialSession: GradingSession = {
                    id: `session-${Date.now()}`,
                    courseId: courseId || 'default',
                    assignmentId: assignmentId || 'default',
                    studentIds: students.map(s => s.id),
                    currentStudentIndex: 0,
                    lastSaved: new Date(),
                    isAutoSaving: false
                };

                const sessionModelInstance = new GradingSessionModel(initialSession);

                setStudentModel(studentModelInstance);
                setSessionModel(sessionModelInstance);

            } catch (err) {
                setError(err instanceof Error ? err.message : 'An unknown error occurred');
            } finally {
                setLoading(false);
            }
        };

        initializeController();
    }, [courseId, assignmentId]);

    // Auto-save functionality
    useEffect(() => {
        if (!sessionModel) return;

        const autoSave = async () => {
            sessionModel.setAutoSaving(true);

            try {
                const currentStudentId = sessionModel.getCurrentStudentId();
                if (currentStudentId) {
                    await gradingService.saveStudentGrades(currentStudentId);
                }
                sessionModel.updateLastSaved();
            } catch (err) {
                console.error('Auto-save failed:', err);
            } finally {
                sessionModel.setAutoSaving(false);
            }
        };

        const interval = setInterval(autoSave, 60000); // Auto-save every 60 seconds
        return () => clearInterval(interval);
    }, [sessionModel, gradingService]);

    // Navigation functions - Optimized for performance
    const nextStudent = useCallback(() => {
        if (!sessionModel) return false;

        const success = sessionModel.nextStudent();
        if (success) {
            setSelectedRubric(null);
            // Force a single re-render instead of multiple state updates
            setForceUpdate(prev => prev + 1);
        }
        return success;
    }, [sessionModel]);

    const prevStudent = useCallback(() => {
        if (!sessionModel) return false;

        const success = sessionModel.previousStudent();
        if (success) {
            setSelectedRubric(null);
            // Force a single re-render instead of multiple state updates
            setForceUpdate(prev => prev + 1);
        }
        return success;
    }, [sessionModel]);

    const goToStudent = useCallback((index: number) => {
        if (!sessionModel) return false;

        sessionModel.setCurrentStudentIndex(index);
        setSelectedRubric(null);
        setForceUpdate(prev => prev + 1);
        return true;
    }, [sessionModel]);

    // Debounced score update to prevent too many API calls
    const debouncedUpdateRef = useRef<NodeJS.Timeout | null>(null);

    // Score management
    const updateRubricScore = useCallback(async (rubricId: string, score: number) => {
        if (!studentModel || !sessionModel) return false;

        try {
            const currentStudentId = sessionModel.getCurrentStudentId();
            const currentStudentIndex = sessionModel.getCurrentStudentIndex();

            if (!currentStudentId) return false;

            // Update local model immediately for responsive UI
            const success = studentModel.updateRubricScore(currentStudentId, rubricId, score);

            if (success) {
                // Mark as user edited
                sessionModel.markScoreAsEdited(currentStudentIndex, rubricId);

                // Force update to reflect changes immediately
                setForceUpdate(prev => prev + 1);

                // Debounce the API call to reduce network requests
                if (debouncedUpdateRef.current) {
                    clearTimeout(debouncedUpdateRef.current);
                }

                debouncedUpdateRef.current = setTimeout(async () => {
                    try {
                        await gradingService.updateRubricScore(currentStudentId, rubricId, score);
                        sessionModel.updateLastSaved();
                        setForceUpdate(prev => prev + 1);
                    } catch (err) {
                        console.error('Failed to save score to server:', err);
                    }
                }, 500); // Wait 500ms before saving to server

                return true;
            }
        } catch (err) {
            console.error('Failed to update rubric score:', err);
            setError('Failed to update score');
        }

        return false;
    }, [studentModel, sessionModel, gradingService]);

    const saveGrades = useCallback(async () => {
        if (!sessionModel) return false;

        try {
            sessionModel.setAutoSaving(true);

            const currentStudentId = sessionModel.getCurrentStudentId();
            if (currentStudentId) {
                const result = await gradingService.saveStudentGrades(currentStudentId);
                if (result.success) {
                    sessionModel.updateLastSaved();
                    return true;
                } else {
                    setError(result.message || 'Failed to save grades');
                }
            }
        } catch (err) {
            console.error('Save failed:', err);
            setError('Failed to save grades');
        } finally {
            sessionModel.setAutoSaving(false);
        }

        return false;
    }, [sessionModel, gradingService]);

    const submitGrades = useCallback(async () => {
        if (!sessionModel) return false;

        try {
            const session = sessionModel.getSession();
            const result = await gradingService.submitGrades(session.studentIds);

            if (result.success) {
                return true;
            } else {
                setError(result.message || 'Failed to submit grades');
            }
        } catch (err) {
            console.error('Submit failed:', err);
            setError('Failed to submit grades');
        }

        return false;
    }, [sessionModel, gradingService]);

    // Text highlighting - Memoized for performance
    const getHighlightedText = useCallback((text: string, rubricId: string): string => {
        if (!studentModel || !sessionModel || selectedRubric !== rubricId) return text;

        const currentStudentId = sessionModel.getCurrentStudentId();
        if (!currentStudentId) return text;

        const rubric = studentModel.getRubric(currentStudentId, rubricId);
        if (!rubric?.highlightedText) return text;

        const highlightText = rubric.highlightedText;

        // Use a more efficient highlighting method
        if (!text.includes(highlightText)) return text;

        return text.replace(
            new RegExp(highlightText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
            `<span class="bg-blue-200 text-blue-800 px-1 rounded">${highlightText}</span>`
        );
    }, [studentModel, sessionModel, selectedRubric]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'ArrowLeft':
                        e.preventDefault();
                        prevStudent();
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        nextStudent();
                        break;
                    case 's':
                        e.preventDefault();
                        saveGrades();
                        break;
                }
            }

            // Number keys to highlight rubrics
            if (e.key >= '1' && e.key <= '3' && studentModel && sessionModel) {
                const rubricIndex = parseInt(e.key) - 1;
                const currentStudentId = sessionModel.getCurrentStudentId();
                if (currentStudentId) {
                    const student = studentModel.getStudentById(currentStudentId);
                    if (student?.rubrics[rubricIndex]) {
                        setSelectedRubric(student.rubrics[rubricIndex].id);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [prevStudent, nextStudent, saveGrades, studentModel, sessionModel]);

    // Computed values - Memoized for performance
    const currentStudent = useMemo(() => {
        if (!studentModel || !sessionModel) return null;
        return studentModel.getStudentByIndex(sessionModel.getCurrentStudentIndex());
    }, [studentModel, sessionModel, forceUpdate]);

    const currentStudentIndex = useMemo(() => {
        return sessionModel?.getCurrentStudentIndex() ?? 0;
    }, [sessionModel, forceUpdate]);

    const totalStudents = useMemo(() => {
        return sessionModel?.getTotalStudents() ?? 0;
    }, [sessionModel]);

    const lastSaved = useMemo(() => {
        return sessionModel?.getLastSaved() ?? new Date();
    }, [sessionModel, forceUpdate]);

    const isAutoSaving = useMemo(() => {
        return sessionModel?.isAutoSaving() ?? false;
    }, [sessionModel, forceUpdate]);

    const hasUserEditedScore = useCallback((rubricId: string): boolean => {
        if (!sessionModel) return false;
        return sessionModel.hasUserEditedScore(currentStudentIndex, rubricId);
    }, [sessionModel, currentStudentIndex]);

    // Cleanup debounced updates on unmount
    useEffect(() => {
        return () => {
            if (debouncedUpdateRef.current) {
                clearTimeout(debouncedUpdateRef.current);
            }
        };
    }, []);

    return {
        // State
        loading,
        error,
        currentStudent,
        currentStudentIndex,
        totalStudents,
        selectedRubric,
        sidebarCollapsed,
        lastSaved,
        isAutoSaving,

        // Actions
        nextStudent,
        prevStudent,
        goToStudent,
        updateRubricScore,
        saveGrades,
        submitGrades,
        setSelectedRubric,
        setSidebarCollapsed,
        getHighlightedText,
        hasUserEditedScore,

        // Utils
        setError
    };
};