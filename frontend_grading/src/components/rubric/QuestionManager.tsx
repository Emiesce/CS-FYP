import React, { useState, useCallback, useMemo } from 'react';
import { RubricQuestion, ScoringCriterion } from '../../types';

interface QuestionManagerProps {
    questions: RubricQuestion[];
    onAddQuestion: () => void;
    onUpdateQuestion: (questionId: string, updates: Partial<RubricQuestion>) => void;
    onRemoveQuestion: (questionId: string) => void;
    onAddScoringCriterion: (questionId: string) => void;
    onUpdateScoringCriterion: (questionId: string, criterionId: string, updates: Partial<ScoringCriterion>) => void;
    onRemoveScoringCriterion: (questionId: string, criterionId: string) => void;
    disabled?: boolean;
}

interface ValidationErrors {
    [key: string]: string;
}

export const QuestionManager: React.FC<QuestionManagerProps> = ({
    questions,
    onAddQuestion,
    onUpdateQuestion,
    onRemoveQuestion,
    onAddScoringCriterion,
    onUpdateScoringCriterion,
    onRemoveScoringCriterion,
    disabled = false
}) => {
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());

    // Validation functions
    const validateScoreRange = useCallback((min: number, max: number): string | null => {
        if (min < 0) return 'Minimum score cannot be negative';
        if (max <= min) return 'Maximum score must be greater than minimum score';
        if (max > 100) return 'Maximum score cannot exceed 100';
        return null;
    }, []);

    const validateScoringCriteria = useCallback((criteria: ScoringCriterion[]): string | null => {
        if (criteria.length === 0) return null;

        // Check for empty score ranges
        const emptyCriteria = criteria.filter(c => !c.scoreRange.trim());
        if (emptyCriteria.length > 0) {
            return 'All scoring criteria must have a score range';
        }

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

    // Calculate total points across all questions
    const totalPoints = useMemo(() => {
        return questions.reduce(
            (acc, question) => ({
                min: acc.min + question.minScore,
                max: acc.max + question.maxScore
            }),
            { min: 0, max: 0 }
        );
    }, [questions]);

    // Handle question score changes with validation
    const handleQuestionScoreChange = useCallback((
        questionId: string,
        field: 'minScore' | 'maxScore',
        value: string
    ) => {
        const numValue = parseFloat(value) || 0;
        const question = questions.find(q => q.id === questionId);

        if (!question) return;

        const updates: Partial<RubricQuestion> = { [field]: numValue };
        const newMin = field === 'minScore' ? numValue : question.minScore;
        const newMax = field === 'maxScore' ? numValue : question.maxScore;

        const error = validateScoreRange(newMin, newMax);
        const errorKey = `${questionId}-score`;

        if (error) {
            setErrors(prev => ({ ...prev, [errorKey]: error }));
        } else {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }

        onUpdateQuestion(questionId, updates);
    }, [questions, onUpdateQuestion, validateScoreRange]);

    // Handle scoring criterion changes with validation
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
                const errorKey = `${questionId}-criteria`;

                if (error) {
                    setErrors(prev => ({ ...prev, [errorKey]: error }));
                } else {
                    setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors[errorKey];
                        return newErrors;
                    });
                }
            } else if (value.trim()) {
                // Invalid format but not empty
                const errorKey = `${criterionId}-range`;
                setErrors(prev => ({ ...prev, [errorKey]: 'Invalid score range format (use "5" or "3-5")' }));
                updates = { scoreRange: value };
            } else {
                // Empty value
                updates = { scoreRange: value };
                const errorKey = `${criterionId}-range`;
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[errorKey];
                    return newErrors;
                });
            }
        } else {
            updates = { [field]: value };
        }

        onUpdateScoringCriterion(questionId, criterionId, updates);
    }, [questions, onUpdateScoringCriterion, parseScoreRange, validateScoringCriteria]);

    // Toggle question expansion
    const toggleQuestionExpansion = useCallback((questionId: string) => {
        setExpandedQuestions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(questionId)) {
                newSet.delete(questionId);
            } else {
                newSet.add(questionId);
            }
            return newSet;
        });
    }, []);

    return (
        <div className="space-y-6">
            {/* Header with total points and add button */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Questions</h3>
                    <div className="mt-1 text-sm text-gray-600">
                        Total: {totalPoints.min} - {totalPoints.max} points
                        {questions.length > 0 && (
                            <span className="ml-2">
                                ({questions.length} question{questions.length !== 1 ? 's' : ''})
                            </span>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onAddQuestion}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    disabled={disabled}
                >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Question
                </button>
            </div>

            {/* Questions list */}
            {questions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No questions added yet</h4>
                    <p className="text-gray-600 mb-4">Start building your rubric by adding your first question</p>
                    <button
                        type="button"
                        onClick={onAddQuestion}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        disabled={disabled}
                    >
                        Add First Question
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {questions.map((question, index) => (
                        <QuestionCard
                            key={question.id}
                            question={question}
                            index={index}
                            isExpanded={expandedQuestions.has(question.id)}
                            onToggleExpansion={() => toggleQuestionExpansion(question.id)}
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
                            disabled={disabled}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Individual Question Card Component
interface QuestionCardProps {
    question: RubricQuestion;
    index: number;
    isExpanded: boolean;
    onToggleExpansion: () => void;
    onUpdate: (updates: Partial<RubricQuestion>) => void;
    onRemove: () => void;
    onAddCriterion: () => void;
    onUpdateCriterion: (criterionId: string, updates: Partial<ScoringCriterion>) => void;
    onRemoveCriterion: (criterionId: string) => void;
    onScoreChange: (field: 'minScore' | 'maxScore', value: string) => void;
    onCriterionChange: (criterionId: string, field: keyof ScoringCriterion, value: string) => void;
    errors: ValidationErrors;
    disabled: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
    question,
    index,
    isExpanded,
    onToggleExpansion,
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
    const hasErrors = Object.keys(errors).some(key => key.startsWith(question.id));

    return (
        <div className={`border rounded-lg bg-white shadow-sm ${hasErrors ? 'border-red-300' : 'border-gray-200'}`}>
            {/* Question Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            type="button"
                            onClick={onToggleExpansion}
                            className="text-gray-400 hover:text-gray-600 focus:outline-none"
                            disabled={disabled}
                        >
                            <svg
                                className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <div>
                            <h4 className="text-lg font-medium text-gray-900">
                                Question {index + 1}
                            </h4>
                            <div className="text-sm text-gray-600">
                                {question.minScore} - {question.maxScore} points
                                {question.scoringCriteria.length > 0 && (
                                    <span className="ml-2">
                                        • {question.scoringCriteria.length} criteria
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onRemove}
                        className="text-red-600 hover:text-red-800 focus:outline-none p-1"
                        disabled={disabled}
                        title="Remove question"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>

                {/* Quick preview when collapsed */}
                {!isExpanded && question.title && (
                    <div className="mt-2 text-sm text-gray-700 truncate">
                        {question.title}
                    </div>
                )}
            </div>

            {/* Expanded Question Content */}
            {isExpanded && (
                <div className="p-4 space-y-4">
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
                    <ScoringCriteriaManager
                        questionId={question.id}
                        criteria={question.scoringCriteria}
                        onAddCriterion={onAddCriterion}
                        onUpdateCriterion={onUpdateCriterion}
                        onRemoveCriterion={onRemoveCriterion}
                        onCriterionChange={onCriterionChange}
                        errors={errors}
                        disabled={disabled}
                    />
                </div>
            )}
        </div>
    );
};

// Scoring Criteria Manager Component
interface ScoringCriteriaManagerProps {
    questionId: string;
    criteria: ScoringCriterion[];
    onAddCriterion: () => void;
    onUpdateCriterion: (criterionId: string, updates: Partial<ScoringCriterion>) => void;
    onRemoveCriterion: (criterionId: string) => void;
    onCriterionChange: (criterionId: string, field: keyof ScoringCriterion, value: string) => void;
    errors: ValidationErrors;
    disabled: boolean;
}

const ScoringCriteriaManager: React.FC<ScoringCriteriaManagerProps> = ({
    questionId,
    criteria,
    onAddCriterion,
    onUpdateCriterion,
    onRemoveCriterion,
    onCriterionChange,
    errors,
    disabled
}) => {
    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                    Scoring Criteria
                </label>
                <button
                    type="button"
                    onClick={onAddCriterion}
                    className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none font-medium"
                    disabled={disabled}
                >
                    + Add Criterion
                </button>
            </div>

            {errors[`${questionId}-criteria`] && (
                <p className="text-sm text-red-600 mb-3">{errors[`${questionId}-criteria`]}</p>
            )}

            {criteria.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-sm text-gray-600 mb-2">No scoring criteria defined</p>
                    <button
                        type="button"
                        onClick={onAddCriterion}
                        className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none font-medium"
                        disabled={disabled}
                    >
                        Add your first criterion
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {criteria.map((criterion) => (
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
            )}
        </div>
    );
};

// Individual Scoring Criterion Editor
interface ScoringCriterionEditorProps {
    criterion: ScoringCriterion;
    onUpdate: (updates: Partial<ScoringCriterion>) => void;
    onRemove: () => void;
    onChange: (field: keyof ScoringCriterion, value: string) => void;
    errors: ValidationErrors;
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
        <div className="flex items-start space-x-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="flex-1 space-y-2">
                <div className="grid grid-cols-4 gap-2">
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
                    </div>
                    <div className="col-span-3">
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
                {errors[`${criterion.id}-range`] && (
                    <p className="text-xs text-red-600">{errors[`${criterion.id}-range`]}</p>
                )}
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="text-red-600 hover:text-red-800 focus:outline-none mt-1 p-1"
                disabled={disabled}
                title="Remove criterion"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};