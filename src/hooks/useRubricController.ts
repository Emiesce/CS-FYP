import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RubricService } from '../services/RubricService';
import {
    RubricData,
    RubricQuestion,
    ScoringCriterion,
    UploadedFile,
    Course,
    Assignment,
    ApiResponse
} from '../types';

interface UseRubricControllerProps {
    courseId?: string;
    assignmentId?: string;
}

interface FileUploadState {
    file: File | null;
    progress: number;
    status: 'idle' | 'uploading' | 'processing' | 'completed' | 'error';
    error?: string;
}

interface LoadingState {
    rubrics: boolean;
    courses: boolean;
    assignments: boolean;
    creating: boolean;
    updating: boolean;
    deleting: boolean;
    uploading: boolean;
    assigning: boolean;
}

interface FormState {
    title: string;
    description: string;
    questions: RubricQuestion[];
    courseId?: string;
    assignmentId?: string;
}

interface ModalState {
    isDetailModalOpen: boolean;
    isCreateModalOpen: boolean;
    isDeleteModalOpen: boolean;
    selectedRubric: RubricData | null;
    rubricToDelete: string | null;
}

interface FilterState {
    courseId?: string;
    assignmentId?: string;
    searchTerm: string;
    dateRange?: {
        start: Date;
        end: Date;
    };
}

export const useRubricController = ({ courseId, assignmentId }: UseRubricControllerProps = {}) => {
    // Services - Memoize to prevent recreation
    const rubricService = useMemo(() => new RubricService(), []);

    // Core state
    const [rubrics, setRubrics] = useState<RubricData[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Loading states for different operations
    const [loadingState, setLoadingState] = useState<LoadingState>({
        rubrics: true,
        courses: true,
        assignments: true,
        creating: false,
        updating: false,
        deleting: false,
        uploading: false,
        assigning: false
    });

    // File upload state
    const [fileUploadState, setFileUploadState] = useState<FileUploadState>({
        file: null,
        progress: 0,
        status: 'idle'
    });

    // Form state for manual rubric creation
    const [formState, setFormState] = useState<FormState>({
        title: '',
        description: '',
        questions: [],
        courseId,
        assignmentId
    });

    // Modal states
    const [modalState, setModalState] = useState<ModalState>({
        isDetailModalOpen: false,
        isCreateModalOpen: false,
        isDeleteModalOpen: false,
        selectedRubric: null,
        rubricToDelete: null
    });

    // Filter state
    const [filterState, setFilterState] = useState<FilterState>({
        courseId,
        assignmentId,
        searchTerm: ''
    });

    // Performance optimization - prevent unnecessary re-renders
    const [forceUpdate, setForceUpdate] = useState(0);

    // Debounced operations
    const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize the controller
    useEffect(() => {
        const initializeController = async () => {
            try {
                setError(null);

                // Load initial data in parallel
                const [rubricsResponse, coursesResponse, assignmentsResponse] = await Promise.all([
                    rubricService.getRubrics(filterState.courseId, filterState.assignmentId),
                    rubricService.getCourses(),
                    rubricService.getAssignments(filterState.courseId)
                ]);

                if (rubricsResponse.data) {
                    setRubrics(rubricsResponse.data);
                } else if (rubricsResponse.message) {
                    console.warn('Failed to load rubrics:', rubricsResponse.message);
                }
                setLoadingState(prev => ({ ...prev, rubrics: false }));

                if (coursesResponse.success && coursesResponse.data) {
                    setCourses(coursesResponse.data);
                } else if (!coursesResponse.success) {
                    console.warn('Failed to load courses:', coursesResponse.message);
                }
                setLoadingState(prev => ({ ...prev, courses: false }));

                if (assignmentsResponse.success && assignmentsResponse.data) {
                    setAssignments(assignmentsResponse.data);
                } else if (!assignmentsResponse.success) {
                    console.warn('Failed to load assignments:', assignmentsResponse.message);
                }
                setLoadingState(prev => ({ ...prev, assignments: false }));

            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
                console.error('Failed to initialize rubric controller:', err);
                setError(`Failed to load data: ${errorMessage}`);
                setLoadingState({
                    rubrics: false,
                    courses: false,
                    assignments: false,
                    creating: false,
                    updating: false,
                    deleting: false,
                    uploading: false,
                    assigning: false
                });
            }
        };

        initializeController();
    }, [filterState.courseId, filterState.assignmentId, rubricService]);

    // File upload operations
    const handleFileSelect = useCallback((file: File) => {
        console.log('=== FILE SELECTION START ===');
        console.log('File selected:', {
            name: file.name,
            type: file.type,
            size: file.size
        });

        const validation = rubricService.validateFile(file);
        console.log('File validation result:', validation);

        if (!validation.isValid) {
            console.error('File validation failed:', validation.error);
            setFileUploadState({
                file: null,
                progress: 0,
                status: 'error',
                error: validation.error
            });
            return;
        }

        console.log('File validation passed, setting file state...');
        setFileUploadState({
            file,
            progress: 0,
            status: 'idle'
        });
        console.log('=== FILE SELECTION END ===');
    }, [rubricService]);

    const uploadFile = useCallback(async () => {
        console.log('=== UPLOAD FILE START ===');
        console.log('Current fileUploadState:', fileUploadState);

        if (!fileUploadState.file) {
            console.error('No file to upload!');
            return false;
        }

        console.log('Starting upload for file:', fileUploadState.file.name);

        try {
            setLoadingState(prev => ({ ...prev, uploading: true }));
            setFileUploadState(prev => ({
                ...prev,
                status: 'uploading',
                progress: 0
            }));

            console.log('Set uploading state, starting progress simulation...');

            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setFileUploadState(prev => ({
                    ...prev,
                    progress: Math.min(prev.progress + 10, 90)
                }));
            }, 100);

            const response = await rubricService.uploadRubricFile(
                fileUploadState.file,
                filterState.courseId
            );

            clearInterval(progressInterval);

            console.log('Hook received response:', response);
            console.log('Response success:', response.success);
            console.log('Response data:', response.data);

            if (response.success) {
                console.log('Hook: Upload successful, updating state...');
                setFileUploadState({
                    file: null,
                    progress: 100,
                    status: 'completed'
                });

                // Add new rubric to list
                setRubrics(prev => {
                    console.log('Hook: Adding rubric to list, current count:', prev.length);
                    return [response.data, ...prev];
                });
                setForceUpdate(prev => prev + 1);

                // Reset upload state after success
                setTimeout(() => {
                    setFileUploadState({
                        file: null,
                        progress: 0,
                        status: 'idle'
                    });
                }, 2000);

                return true;
            } else {
                console.log('Hook: Upload failed, response:', response);
                setFileUploadState(prev => ({
                    ...prev,
                    status: 'error',
                    error: response.message || 'Upload failed'
                }));
                return false;
            }
        } catch (err) {
            setFileUploadState(prev => ({
                ...prev,
                status: 'error',
                error: err instanceof Error ? err.message : 'Upload failed'
            }));
            return false;
        } finally {
            setLoadingState(prev => ({ ...prev, uploading: false }));
        }
    }, [fileUploadState.file, filterState.courseId, rubricService]);

    // Form operations for manual rubric creation
    const updateFormField = useCallback(<K extends keyof FormState>(
        field: K,
        value: FormState[K]
    ) => {
        setFormState(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    const addQuestion = useCallback(() => {
        const newQuestion: RubricQuestion = {
            id: `q-${Date.now()}`,
            title: '',
            description: '',
            minScore: 0,
            maxScore: 10,
            scoringCriteria: []
        };

        setFormState(prev => ({
            ...prev,
            questions: [...prev.questions, newQuestion]
        }));
    }, []);

    const updateQuestion = useCallback((questionId: string, updates: Partial<RubricQuestion>) => {
        setFormState(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === questionId ? { ...q, ...updates } : q
            )
        }));
    }, []);

    const removeQuestion = useCallback((questionId: string) => {
        setFormState(prev => ({
            ...prev,
            questions: prev.questions.filter(q => q.id !== questionId)
        }));
    }, []);

    const addScoringCriterion = useCallback((questionId: string) => {
        const newCriterion: ScoringCriterion = {
            id: `c-${Date.now()}`,
            scoreRange: '',
            description: '',
            minPoints: 0,
            maxPoints: 0
        };

        setFormState(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === questionId
                    ? { ...q, scoringCriteria: [...q.scoringCriteria, newCriterion] }
                    : q
            )
        }));
    }, []);

    const updateScoringCriterion = useCallback((
        questionId: string,
        criterionId: string,
        updates: Partial<ScoringCriterion>
    ) => {
        setFormState(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === questionId
                    ? {
                        ...q,
                        scoringCriteria: q.scoringCriteria.map(c =>
                            c.id === criterionId ? { ...c, ...updates } : c
                        )
                    }
                    : q
            )
        }));
    }, []);

    const removeScoringCriterion = useCallback((questionId: string, criterionId: string) => {
        setFormState(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === questionId
                    ? {
                        ...q,
                        scoringCriteria: q.scoringCriteria.filter(c => c.id !== criterionId)
                    }
                    : q
            )
        }));
    }, []);

    const resetForm = useCallback(() => {
        setFormState({
            title: '',
            description: '',
            questions: [],
            courseId: filterState.courseId,
            assignmentId: filterState.assignmentId
        });
    }, [filterState.courseId, filterState.assignmentId]);

    const createRubric = useCallback(async (rubricData?: Partial<RubricData>) => {
        try {
            console.log('useRubricController.createRubric: Starting with data:', rubricData);

            setLoadingState(prev => ({ ...prev, creating: true }));
            setError(null);

            // Use provided rubricData or fall back to formState
            const dataToSubmit = rubricData || formState;
            console.log('useRubricController.createRubric: Data to submit:', dataToSubmit);

            const response = await rubricService.createRubric(dataToSubmit);
            console.log('useRubricController.createRubric: Service response:', response);

            if (response.success) {
                console.log('useRubricController.createRubric: Success, adding to rubrics list');
                setRubrics(prev => {
                    const newList = [response.data, ...prev];
                    console.log('useRubricController.createRubric: New rubrics list length:', newList.length);
                    return newList;
                });
                resetForm();
                setModalState(prev => ({ ...prev, isCreateModalOpen: false }));
                setForceUpdate(prev => prev + 1);
                return true;
            } else {
                console.error('useRubricController.createRubric: Failed:', response.message);
                setError(response.message || 'Failed to create rubric');
                return false;
            }
        } catch (err) {
            console.error('useRubricController.createRubric: Exception:', err);
            setError(err instanceof Error ? err.message : 'Failed to create rubric');
            return false;
        } finally {
            setLoadingState(prev => ({ ...prev, creating: false }));
        }
    }, [formState, rubricService, resetForm]);

    // CRUD operations with enhanced error handling and loading states
    const getRubricById = useCallback(async (id: string): Promise<RubricData | null> => {
        try {
            const response = await rubricService.getRubricById(id);
            return response.success ? response.data : null;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch rubric');
            return null;
        }
    }, [rubricService]);

    const updateRubric = useCallback(async (id: string, updates: Partial<RubricData>) => {
        try {
            setLoadingState(prev => ({ ...prev, updating: true }));
            setError(null);

            const response = await rubricService.updateRubric(id, updates);

            if (response.success) {
                setRubrics(prev => prev.map(r => r.id === id ? response.data : r));

                // Update selected rubric in modal if it's the one being updated
                setModalState(prev => ({
                    ...prev,
                    selectedRubric: prev.selectedRubric?.id === id ? response.data : prev.selectedRubric
                }));

                setForceUpdate(prev => prev + 1);
                return true;
            } else {
                setError(response.message || 'Failed to update rubric');
                return false;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update rubric');
            return false;
        } finally {
            setLoadingState(prev => ({ ...prev, updating: false }));
        }
    }, [rubricService]);

    const deleteRubric = useCallback(async (id: string) => {
        try {
            setLoadingState(prev => ({ ...prev, deleting: true }));
            setError(null);

            const response = await rubricService.deleteRubric(id);

            if (response.success) {
                setRubrics(prev => prev.filter(r => r.id !== id));
                setModalState(prev => ({
                    ...prev,
                    isDeleteModalOpen: false,
                    rubricToDelete: null,
                    // Close detail modal if the deleted rubric was selected
                    isDetailModalOpen: prev.selectedRubric?.id === id ? false : prev.isDetailModalOpen,
                    selectedRubric: prev.selectedRubric?.id === id ? null : prev.selectedRubric
                }));
                setForceUpdate(prev => prev + 1);
                return true;
            } else {
                setError(response.message || 'Failed to delete rubric');
                return false;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete rubric');
            return false;
        } finally {
            setLoadingState(prev => ({ ...prev, deleting: false }));
        }
    }, [rubricService]);

    const assignRubricToAssignment = useCallback(async (rubricId: string, assignmentId: string) => {
        try {
            setLoadingState(prev => ({ ...prev, assigning: true }));
            setError(null);

            const response = await rubricService.assignRubricToAssignment(rubricId, assignmentId);

            if (response.success) {
                setRubrics(prev => prev.map(r =>
                    r.id === rubricId ? { ...r, assignmentId } : r
                ));

                // Update selected rubric in modal if it's the one being assigned
                setModalState(prev => ({
                    ...prev,
                    selectedRubric: prev.selectedRubric?.id === rubricId
                        ? { ...prev.selectedRubric, assignmentId }
                        : prev.selectedRubric
                }));

                setForceUpdate(prev => prev + 1);
                return true;
            } else {
                setError(response.message || 'Failed to assign rubric');
                return false;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to assign rubric');
            return false;
        } finally {
            setLoadingState(prev => ({ ...prev, assigning: false }));
        }
    }, [rubricService]);

    // Batch operations for better performance
    const refreshRubrics = useCallback(async () => {
        try {
            console.log('=== REFRESH RUBRICS START ===');
            console.log('Filter state:', { courseId: filterState.courseId, assignmentId: filterState.assignmentId });

            setLoadingState(prev => ({ ...prev, rubrics: true }));
            setError(null);

            const response = await rubricService.getRubrics(filterState.courseId, filterState.assignmentId);
            console.log('getRubrics response:', response);

            if (response.data) {
                console.log('Setting rubrics to:', response.data.length, 'items');
                setRubrics(response.data);
                setForceUpdate(prev => prev + 1);
            } else {
                console.error('No data in getRubrics response');
                if (response.message) {
                    setError(`Failed to load rubrics: ${response.message}`);
                }
            }
            console.log('=== REFRESH RUBRICS END ===');
        } catch (err) {
            console.error('Error in refreshRubrics:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to refresh rubrics';
            setError(`Storage error: ${errorMessage}`);
        } finally {
            setLoadingState(prev => ({ ...prev, rubrics: false }));
        }
    }, [rubricService, filterState.courseId, filterState.assignmentId]);

    const refreshAssignments = useCallback(async (courseId?: string) => {
        try {
            setLoadingState(prev => ({ ...prev, assignments: true }));

            const response = await rubricService.getAssignments(courseId);

            if (response.success && response.data) {
                setAssignments(response.data);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to refresh assignments');
        } finally {
            setLoadingState(prev => ({ ...prev, assignments: false }));
        }
    }, [rubricService]);

    // Modal operations
    const openDetailModal = useCallback((rubric: RubricData) => {
        setModalState(prev => ({
            ...prev,
            isDetailModalOpen: true,
            selectedRubric: rubric
        }));
    }, []);

    const closeDetailModal = useCallback(() => {
        setModalState(prev => ({
            ...prev,
            isDetailModalOpen: false,
            selectedRubric: null
        }));
    }, []);

    const openCreateModal = useCallback(() => {
        resetForm();
        setModalState(prev => ({
            ...prev,
            isCreateModalOpen: true
        }));
    }, [resetForm]);

    const closeCreateModal = useCallback(() => {
        setModalState(prev => ({
            ...prev,
            isCreateModalOpen: false
        }));
        resetForm();
    }, [resetForm]);

    const openDeleteModal = useCallback((rubricId: string) => {
        setModalState(prev => ({
            ...prev,
            isDeleteModalOpen: true,
            rubricToDelete: rubricId
        }));
    }, []);

    const closeDeleteModal = useCallback(() => {
        setModalState(prev => ({
            ...prev,
            isDeleteModalOpen: false,
            rubricToDelete: null
        }));
    }, []);

    // Filter operations with automatic refresh
    const updateFilter = useCallback(<K extends keyof FilterState>(
        field: K,
        value: FilterState[K]
    ) => {
        setFilterState(prev => ({
            ...prev,
            [field]: value
        }));

        // Auto-refresh assignments when course changes
        if (field === 'courseId') {
            refreshAssignments(value as string);
        }
    }, [refreshAssignments]);

    const clearFilters = useCallback(() => {
        setFilterState({
            courseId: undefined,
            assignmentId: undefined,
            searchTerm: ''
        });
        refreshAssignments();
    }, [refreshAssignments]);

    // Computed values - Memoized for performance
    const filteredRubrics = useMemo(() => {
        let filtered = [...rubrics];

        // Apply search filter
        if (filterState.searchTerm) {
            const searchLower = filterState.searchTerm.toLowerCase();
            filtered = filtered.filter(rubric =>
                rubric.title.toLowerCase().includes(searchLower) ||
                rubric.description.toLowerCase().includes(searchLower)
            );
        }

        // Apply date range filter
        if (filterState.dateRange) {
            filtered = filtered.filter(rubric =>
                rubric.createdAt >= filterState.dateRange!.start &&
                rubric.createdAt <= filterState.dateRange!.end
            );
        }

        return filtered;
    }, [rubrics, filterState, forceUpdate]);

    const totalPoints = useMemo(() => {
        return {
            min: formState.questions.reduce((sum, q) => sum + q.minScore, 0),
            max: formState.questions.reduce((sum, q) => sum + q.maxScore, 0)
        };
    }, [formState.questions]);

    const isFormValid = useMemo(() => {
        return formState.title.trim().length > 0 && formState.questions.length > 0;
    }, [formState.title, formState.questions]);

    const isLoading = useMemo(() => {
        return Object.values(loadingState).some(loading => loading);
    }, [loadingState]);

    const hasAnyRubrics = useMemo(() => {
        return rubrics.length > 0;
    }, [rubrics]);

    // Error handling utilities
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const handleError = useCallback((error: unknown, context: string) => {
        const message = error instanceof Error ? error.message : `Unknown error in ${context}`;
        setError(message);
        console.error(`Error in ${context}:`, error);
    }, []);

    // Cleanup debounced operations on unmount
    useEffect(() => {
        return () => {
            if (debouncedSaveRef.current) {
                clearTimeout(debouncedSaveRef.current);
            }
        };
    }, []);

    return {
        // State
        rubrics: filteredRubrics,
        courses,
        assignments,
        loadingState,
        isLoading,
        error,
        fileUploadState,
        formState,
        modalState,
        filterState,
        totalPoints,
        isFormValid,
        hasAnyRubrics,

        // File upload actions
        handleFileSelect,
        uploadFile,

        // Form actions
        updateFormField,
        addQuestion,
        updateQuestion,
        removeQuestion,
        addScoringCriterion,
        updateScoringCriterion,
        removeScoringCriterion,
        resetForm,
        createRubric,

        // CRUD actions
        getRubricById,
        updateRubric,
        deleteRubric,
        assignRubricToAssignment,
        refreshRubrics,
        refreshAssignments,

        // Modal actions
        openDetailModal,
        closeDetailModal,
        openCreateModal,
        closeCreateModal,
        openDeleteModal,
        closeDeleteModal,

        // Filter actions
        updateFilter,
        clearFilters,

        // Utils
        setError,
        clearError,
        handleError
    };
};