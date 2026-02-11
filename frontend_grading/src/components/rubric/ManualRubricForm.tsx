import React, { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../ui/utils';
import { RubricQuestion, ScoringCriterion } from '../../types';

interface ManualRubricFormProps {
    title: string;
    description: string;
    questions: RubricQuestion[];
    onTitleChange: (title: string) => void;
    onDescriptionChange: (description: string) => void;
    onAddQuestion: () => void;
    onUpdateQuestion: (questionId: string, updates: Partial<RubricQuestion>) => void;
    onRemoveQuestion: (questionId: string) => void;
    onAddScoringCriterion: (questionId: string) => void;
    onUpdateScoringCriterion: (questionId: string, criterionId: string, updates: Partial<ScoringCriterion>) => void;
    onRemoveScoringCriterion: (questionId: string, criterionId: string) => void;
    onSubmit: () => void;
    onCancel: () => void;
    isSubmitting?: boolean;
    totalMinPoints: number;
    totalMaxPoints: number;
    onError?: (error: string) => void;
    onSuccess?: (message: string) => void;
}

interface ValidationError {
    field: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
}

interface FormValidationState {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
}

export const ManualRubricForm: React.FC<ManualRubricFormProps> = ({
    title,
    description,
    questions,
    onTitleChange,
    onDescriptionChange,
    onAddQuestion,
    onUpdateQuestion,
    onRemoveQuestion,
    onAddScoringCriterion,
    onUpdateScoringCriterion,
    onRemoveScoringCriterion,
    onSubmit,
    onCancel,
    isSubmitting = false,
    totalMinPoints,
    totalMaxPoints,
    onError,
    onSuccess
}) => {
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [validationState, setValidationState] = useState<FormValidationState>({
        isValid: false,
        errors: [],
        warnings: []
    });
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Comprehensive form validation
    const validateForm = useCallback((): FormValidationState => {
        const errors: ValidationError[] = [];
        const warnings: ValidationError[] = [];

        // Title validation
        if (!title.trim()) {
            errors.push({
                field: 'title',
                message: 'Rubric title is required',
                severity: 'error'
            });
        } else if (title.trim().length < 3) {
            warnings.push({
                field: 'title',
                message: 'Title is very short. Consider a more descriptive title.',
                severity: 'warning'
            });
        } else if (title.trim().length > 100) {
            errors.push({
                field: 'title',
                message: 'Title is too long (maximum 100 characters)',
                severity: 'error'
            });
        }

        // Questions validation
        if (questions.length === 0) {
            errors.push({
                field: 'questions',
                message: 'At least one question is required',
                severity: 'error'
            });
        } else if (questions.length > 20) {
            warnings.push({
                field: 'questions',
                message: 'Large number of questions may be difficult to manage',
                severity: 'warning'
            });
        }

        // Individual question validation
        questions.forEach((question, index) => {
            const questionPrefix = `question-${index}`;

            if (!question.title.trim()) {
                errors.push({
                    field: `${questionPrefix}-title`,
                    message: `Question ${index + 1}: Title is required`,
                    severity: 'error'
                });
            }

            // Score range validation
            const scoreError = validateScoreRange(question.minScore, question.maxScore);
            if (scoreError) {
                errors.push({
                    field: `${questionPrefix}-score`,
                    message: `Question ${index + 1}: ${scoreError}`,
                    severity: 'error'
                });
            }

            // Scoring criteria validation
            if (question.scoringCriteria.length === 0) {
                warnings.push({
                    field: `${questionPrefix}-criteria`,
                    message: `Question ${index + 1}: No scoring criteria defined`,
                    severity: 'warning'
                });
            } else {
                const criteriaError = validateScoringCriteria(question.scoringCriteria);
                if (criteriaError) {
                    errors.push({
                        field: `${questionPrefix}-criteria`,
                        message: `Question ${index + 1}: ${criteriaError}`,
                        severity: 'error'
                    });
                }

                // Check for incomplete criteria
                question.scoringCriteria.forEach((criterion, criterionIndex) => {
                    if (!criterion.description.trim()) {
                        warnings.push({
                            field: `${questionPrefix}-criterion-${criterionIndex}`,
                            message: `Question ${index + 1}, Criterion ${criterionIndex + 1}: Description is empty`,
                            severity: 'warning'
                        });
                    }
                });
            }
        });

        // Total points validation
        if (totalMaxPoints > 1000) {
            warnings.push({
                field: 'total-points',
                message: 'Very high total points may be difficult to grade',
                severity: 'warning'
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }, [title, questions, totalMaxPoints, validateScoreRange, validateScoringCriteria]);

    // Update validation state when form changes
    React.useEffect(() => {
        const newValidationState = validateForm();
        setValidationState(newValidationState);
        setHasUnsavedChanges(true);
    }, [title, description, questions, validateForm]);

    // Validation functions
    const validateScoreRange = useCallback((min: number, max: number): string | null => {
        if (min < 0) return 'Minimum score cannot be negative';
        if (max <= min) return 'Maximum score must be greater than minimum score';
        if (max > 100) return 'Maximum score cannot exceed 100';
        return null;
    }, []);

    const validateScoringCriteria = useCallback((criteria: ScoringCriterion[]): string | null => {
        if (criteria.length === 0) return null;

        // Sort criteria by minPoints to check for overlaps
        const sortedCriteria = [...criteria].sort((a, b) => a.minPoints - b.minPoints);

        for (let i = 0; i < sortedCriteria.length - 1; i++) {
            if (sortedCriteria[i].maxPoints >= sortedCriteria[i + 1].minPoints) {
                return 'Score ranges cannot overlap';
            }
        }

        return null;
    }, []);

    const parseScoreRange = useCallback((scoreRange: string): { min: number; max: number } | null => {
        if (!scoreRange.trim()) return null;

        // Handle single number (e.g., "5")
        if (/^\d+(\.\d+)?$/.test(scoreRange.trim())) {
            const score = parseFloat(scoreRange.trim());
            return { min: score, max: score };
        }

        // Handle range (e.g., "3-5", "1.5-2.5")
        const rangeMatch = scoreRange.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
        if (rangeMatch) {
            const min = parseFloat(rangeMatch[1]);
            const max = parseFloat(rangeMatch[2]);
            return min <= max ? { min, max } : null;
        }

        return null;
    }, []);

    const handleQuestionScoreChange = useCallback((questionId: string, field: 'minScore' | 'maxScore', value: string) => {
        const numValue = parseFloat(value) || 0;
        const question = questions.find(q => q.id === questionId);

        if (!question) return;

        const updates: Partial<RubricQuestion> = { [field]: numValue };
        const newMin = field === 'minScore' ? numValue : question.minScore;
        const newMax = field === 'maxScore' ? numValue : question.maxScore;

        const error = validateScoreRange(newMin, newMax);
        if (error) {
            setErrors(prev => ({ ...prev, [`${questionId}-score`]: error }));
        } else {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[`${questionId}-score`];
                return newErrors;
            });
        }

        onUpdateQuestion(questionId, updates);
    }, [questions, onUpdateQuestion, validateScoreRange]);

    const handleScoringCriterionChange = useCallback((
        questionId: string,
        criterionId: string,
        field: keyof ScoringCriterion,
        value: string
    ) => {
        const question = questions.find(q => q.id === questionId);
        if (!question) return;

        let updates: Partial<ScoringCriterion> = {};

        if (field === 'scoreRange') {
            const parsedRange = parseScoreRange(value);
            if (parsedRange) {
                updates = {
                    scoreRange: value,
                    minPoints: parsedRange.min,
                    maxPoints: parsedRange.max
                };

                // Validate against other criteria
                const updatedCriteria = question.scoringCriteria.map(c =>
                    c.id === criterionId ? { ...c, ...updates } : c
                );

                const error = validateScoringCriteria(updatedCriteria);
                if (error) {
                    setErrors(prev => ({ ...prev, [`${questionId}-criteria`]: error }));
                } else {
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors[`${questionId}-criteria`];
                        return newErrors;
                    });
                }
            } else {
                updates = { scoreRange: value };
                setErrors(prev => ({ ...prev, [`${criterionId}-range`]: 'Invalid score range format' }));
            }
        } else {
            updates = { [field]: value };
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[`${criterionId}-range`];
                return newErrors;
            });
        }

        onUpdateScoringCriterion(questionId, criterionId, updates);
    }, [questions, onUpdateScoringCriterion, parseScoreRange, validateScoringCriteria]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();

        // Final validation
        const finalValidation = validateForm();
        setValidationState(finalValidation);

        if (!finalValidation.isValid) {
            const errorMessage = `Form validation failed: ${finalValidation.errors.map(e => e.message).join(', ')}`;
            if (onError) {
                onError(errorMessage);
            }
            return;
        }

        try {
            setHasUnsavedChanges(false);
            onSubmit();

            if (onSuccess) {
                onSuccess('Rubric created successfully');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create rubric';
            if (onError) {
                onError(errorMessage);
            }
        }
    }, [validateForm, onSubmit, onError, onSuccess]);

    const handleCancel = useCallback(() => {
        if (hasUnsavedChanges) {
            const confirmDiscard = window.confirm(
                'You have unsaved changes. Are you sure you want to cancel?'
            );
            if (!confirmDiscard) return;
        }

        setHasUnsavedChanges(false);
        onCancel();
    }, [hasUnsavedChanges, onCancel]);

    // Enhanced field change handlers with validation
    const handleTitleChange = useCallback((newTitle: string) => {
        onTitleChange(newTitle);
        setHasUnsavedChanges(true);
    }, [onTitleChange]);

    const handleDescriptionChange = useCallback((newDescription: string) => {
        onDescriptionChange(newDescription);
        setHasUnsavedChanges(true);
    }, [onDescriptionChange]);

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Rubric</h2>
                <p className="text-gray-600">Define your grading criteria and scoring system</p>

                {hasUnsavedChanges && (
                    <div className="mt-2 text-sm text-yellow-600 flex items-center gap-1">
                        <AlertTriangle className="size-4" />
                        You have unsaved changes
                    </div>
                )}
            </div>

            {/* Validation Summary */}
            {(validationState.errors.length > 0 || validationState.warnings.length > 0) && (
                <div className="mb-6 space-y-3">
                    {validationState.errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                                <AlertCircle className="size-4" />
                                {validationState.errors.length} Error{validationState.errors.length !== 1 ? 's' : ''} Found
                            </div>
                            <ul className="text-sm text-red-700 space-y-1">
                                {validationState.errors.map((error, index) => (
                                    <li key={index}>• {error.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validationState.warnings.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-yellow-800 font-medium mb-2">
                                <AlertTriangle className="size-4" />
                                {validationState.warnings.length} Warning{validationState.warnings.length !== 1 ? 's' : ''}
                            </div>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                {validationState.warnings.map((warning, index) => (
                                    <li key={index}>• {warning.message}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                    <div>
                        <label htmlFor="rubric-title" className="block text-sm font-medium text-gray-700 mb-1">
                            Rubric Title *
                        </label>
                        <input
                            id="rubric-title"
                            type="text"
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${validationState.errors.some(e => e.field === 'title') ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder="Enter rubric title..."
                            disabled={isSubmitting}
                        />
                        {validationState.errors.find(e => e.field === 'title') && (
                            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                <AlertCircle className="size-3" />
                                {validationState.errors.find(e => e.field === 'title')?.message}
                            </p>
                        )}
                        {validationState.warnings.find(w => w.field === 'title') && (
                            <p className="mt-1 text-sm text-yellow-600 flex items-center gap-1">
                                <AlertTriangle className="size-3" />
                                {validationState.warnings.find(w => w.field === 'title')?.message}
                            </p>
                        )}
                    </div>

                    <div>
                        <label htmlFor="rubric-description" className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                        </label>
                        <textarea
                            id="rubric-description"
                            value={description}
                            onChange={(e) => handleDescriptionChange(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Describe the purpose and scope of this rubric..."
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                {/* Total Points Display */}
                <div className={cn(
                    "border rounded-lg p-4",
                    validationState.isValid ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"
                )}>
                    <div className="flex items-center justify-between">
                        <h3 className={cn(
                            "text-lg font-medium",
                            validationState.isValid ? "text-green-900" : "text-blue-900"
                        )}>
                            Total Points
                            {validationState.isValid && (
                                <CheckCircle className="size-4 text-green-600 inline ml-2" />
                            )}
                        </h3>
                        <div className="text-right">
                            <div className={cn(
                                "text-2xl font-bold",
                                validationState.isValid ? "text-green-900" : "text-blue-900"
                            )}>
                                {totalMinPoints} - {totalMaxPoints}
                            </div>
                            <div className={cn(
                                "text-sm",
                                validationState.isValid ? "text-green-700" : "text-blue-700"
                            )}>
                                {questions.length} question{questions.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                    {validationState.warnings.find(w => w.field === 'total-points') && (
                        <p className="mt-2 text-sm text-yellow-600 flex items-center gap-1">
                            <AlertTriangle className="size-3" />
                            {validationState.warnings.find(w => w.field === 'total-points')?.message}
                        </p>
                    )}
                </div>

                {/* Questions Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900">Questions</h3>
                        <button
                            type="button"
                            onClick={onAddQuestion}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                            disabled={isSubmitting}
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Question
                        </button>
                    </div>

                    {validationState.errors.find(e => e.field === 'questions') && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="size-3" />
                            {validationState.errors.find(e => e.field === 'questions')?.message}
                        </p>
                    )}

                    {questions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p>No questions added yet</p>
                            <p className="text-sm">Click "Add Question" to get started</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {questions.map((question, index) => (
                                <QuestionEditor
                                    key={question.id}
                                    question={question}
                                    index={index}
                                    onUpdate={(updates) => onUpdateQuestion(question.id, updates)}
                                    onRemove={() => onRemoveQuestion(question.id)}
                                    onAddCriterion={() => onAddScoringCriterion(question.id)}
                                    onUpdateCriterion={(criterionId, updates) =>
                                        onUpdateScoringCriterion(question.id, criterionId, updates)
                                    }
                                    onRemoveCriterion={(criterionId) =>
                                        onRemoveScoringCriterion(question.id, criterionId)
                                    }
                                    onScoreChange={(field, value) => handleQuestionScoreChange(question.id, field, value)}
                                    onCriterionChange={(criterionId, field, value) =>
                                        handleScoringCriterionChange(question.id, criterionId, field, value)
                                    }
                                    errors={errors}
                                    disabled={isSubmitting}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        disabled={isSubmitting || !validationState.isValid}
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Creating...
                            </>
                        ) : (
                            'Create Rubric'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Question Editor Component
interface QuestionEditorProps {
    question: RubricQuestion;
    index: number;
    onUpdate: (updates: Partial<RubricQuestion>) => void;
    onRemove: () => void;
    onAddCriterion: () => void;
    onUpdateCriterion: (criterionId: string, updates: Partial<ScoringCriterion>) => void;
    onRemoveCriterion: (criterionId: string) => void;
    onScoreChange: (field: 'minScore' | 'maxScore', value: string) => void;
    onCriterionChange: (criterionId: string, field: keyof ScoringCriterion, value: string) => void;
    errors: Record<string, string>;
    disabled: boolean;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
    question,
    index,
    onUpdate,
    onRemove,
    onAddCriterion,
    onUpdateCriterion,
    onRemoveCriterion,
    onScoreChange,
    onCriterionChange,
    errors,
    disabled
}) => {
    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-start justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">Question {index + 1}</h4>
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-red-600 hover:text-red-800 focus:outline-none"
                    disabled={disabled}
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
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
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[`question-${index}-title`] ? 'border-red-300' : 'border-gray-300'
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
                        Description
                    </label>
                    <textarea
                        value={question.description || ''}
                        onChange={(e) => onUpdate({ description: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Describe what this question evaluates..."
                        disabled={disabled}
                    />
                </div>

                {/* Score Range */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Minimum Score *
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={question.minScore}
                            onChange={(e) => onScoreChange('minScore', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[`${question.id}-score`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                            disabled={disabled}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Maximum Score *
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={question.maxScore}
                            onChange={(e) => onScoreChange('maxScore', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${errors[`${question.id}-score`] ? 'border-red-300' : 'border-gray-300'
                                }`}
                            disabled={disabled}
                        />
                    </div>
                </div>
                {errors[`${question.id}-score`] && (
                    <p className="text-sm text-red-600">{errors[`${question.id}-score`]}</p>
                )}

                {/* Scoring Criteria */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Scoring Criteria
                        </label>
                        <button
                            type="button"
                            onClick={onAddCriterion}
                            className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
                            disabled={disabled}
                        >
                            + Add Criterion
                        </button>
                    </div>

                    {errors[`${question.id}-criteria`] && (
                        <p className="text-sm text-red-600 mb-2">{errors[`${question.id}-criteria`]}</p>
                    )}

                    <div className="space-y-2">
                        {question.scoringCriteria.map((criterion) => (
                            <ScoringCriterionEditor
                                key={criterion.id}
                                criterion={criterion}
                                onUpdate={(updates) => onUpdateCriterion(criterion.id, updates)}
                                onRemove={() => onRemoveCriterion(criterion.id)}
                                onChange={(field, value) => onCriterionChange(criterion.id, field, value)}
                                errors={errors}
                                disabled={disabled}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Scoring Criterion Editor Component
interface ScoringCriterionEditorProps {
    criterion: ScoringCriterion;
    onUpdate: (updates: Partial<ScoringCriterion>) => void;
    onRemove: () => void;
    onChange: (field: keyof ScoringCriterion, value: string) => void;
    errors: Record<string, string>;
    disabled: boolean;
}

const ScoringCriterionEditor: React.FC<ScoringCriterionEditorProps> = ({
    criterion,
    onUpdate,
    onRemove,
    onChange,
    errors,
    disabled
}) => {
    return (
        <div className="flex items-start space-x-2 p-3 bg-white border border-gray-200 rounded-md">
            <div className="flex-1 grid grid-cols-3 gap-2">
                <div>
                    <input
                        type="text"
                        value={criterion.scoreRange}
                        onChange={(e) => onChange('scoreRange', e.target.value)}
                        className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${errors[`${criterion.id}-range`] ? 'border-red-300' : 'border-gray-300'
                            }`}
                        placeholder="e.g., 8-10, 5"
                        disabled={disabled}
                    />
                    {errors[`${criterion.id}-range`] && (
                        <p className="mt-1 text-xs text-red-600">{errors[`${criterion.id}-range`]}</p>
                    )}
                </div>
                <div className="col-span-2">
                    <input
                        type="text"
                        value={criterion.description}
                        onChange={(e) => onChange('description', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Description of this score level..."
                        disabled={disabled}
                    />
                </div>
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="text-red-600 hover:text-red-800 focus:outline-none mt-1"
                disabled={disabled}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};