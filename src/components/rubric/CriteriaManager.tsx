import React, { useState, useCallback, useMemo } from 'react';
import { ScoringCriterion } from '../../types';

interface CriteriaManagerProps {
    questionId: string;
    criteria: ScoringCriterion[];
    questionMinScore: number;
    questionMaxScore: number;
    onAddCriterion: () => void;
    onUpdateCriterion: (criterionId: string, updates: Partial<ScoringCriterion>) => void;
    onRemoveCriterion: (criterionId: string) => void;
    disabled?: boolean;
}

interface CriteriaValidation {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    coverage: {
        coveredMin: number;
        coveredMax: number;
        gaps: Array<{ min: number; max: number }>;
        overlaps: Array<{ criteria: string[]; range: { min: number; max: number } }>;
    };
}

export const CriteriaManager: React.FC<CriteriaManagerProps> = ({
    questionId,
    criteria,
    questionMinScore,
    questionMaxScore,
    onAddCriterion,
    onUpdateCriterion,
    onRemoveCriterion,
    disabled = false
}) => {
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Parse score range utility
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

    // Comprehensive validation of all criteria
    const validation = useMemo((): CriteriaValidation => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (criteria.length === 0) {
            return {
                isValid: true,
                errors: [],
                warnings: ['No scoring criteria defined'],
                coverage: {
                    coveredMin: questionMaxScore,
                    coveredMax: questionMinScore,
                    gaps: [{ min: questionMinScore, max: questionMaxScore }],
                    overlaps: []
                }
            };
        }

        // Parse all criteria ranges
        const parsedCriteria = criteria.map(c => ({
            ...c,
            parsed: parseScoreRange(c.scoreRange)
        })).filter(c => c.parsed !== null);

        // Check for invalid ranges
        const invalidCriteria = criteria.filter(c => !parseScoreRange(c.scoreRange));
        if (invalidCriteria.length > 0) {
            errors.push(`${invalidCriteria.length} criteria have invalid score ranges`);
        }

        if (parsedCriteria.length === 0) {
            return {
                isValid: false,
                errors,
                warnings,
                coverage: {
                    coveredMin: questionMaxScore,
                    coveredMax: questionMinScore,
                    gaps: [{ min: questionMinScore, max: questionMaxScore }],
                    overlaps: []
                }
            };
        }

        // Sort criteria by min score
        const sortedCriteria = parsedCriteria.sort((a, b) => a.parsed!.min - b.parsed!.min);

        // Check for overlaps
        const overlaps: Array<{ criteria: string[]; range: { min: number; max: number } }> = [];
        for (let i = 0; i < sortedCriteria.length - 1; i++) {
            const current = sortedCriteria[i];
            const next = sortedCriteria[i + 1];

            if (current.parsed!.max >= next.parsed!.min) {
                const overlapMin = Math.max(current.parsed!.min, next.parsed!.min);
                const overlapMax = Math.min(current.parsed!.max, next.parsed!.max);

                overlaps.push({
                    criteria: [current.scoreRange, next.scoreRange],
                    range: { min: overlapMin, max: overlapMax }
                });
            }
        }

        if (overlaps.length > 0) {
            errors.push(`${overlaps.length} overlapping score ranges detected`);
        }

        // Calculate coverage
        const ranges = sortedCriteria.map(c => ({ min: c.parsed!.min, max: c.parsed!.max }));
        const mergedRanges: Array<{ min: number; max: number }> = [];

        for (const range of ranges) {
            if (mergedRanges.length === 0) {
                mergedRanges.push(range);
            } else {
                const last = mergedRanges[mergedRanges.length - 1];
                if (range.min <= last.max) {
                    last.max = Math.max(last.max, range.max);
                } else {
                    mergedRanges.push(range);
                }
            }
        }

        const coveredMin = Math.min(...mergedRanges.map(r => r.min));
        const coveredMax = Math.max(...mergedRanges.map(r => r.max));

        // Find gaps
        const gaps: Array<{ min: number; max: number }> = [];

        // Gap before first range
        if (coveredMin > questionMinScore) {
            gaps.push({ min: questionMinScore, max: coveredMin });
        }

        // Gaps between ranges
        for (let i = 0; i < mergedRanges.length - 1; i++) {
            const current = mergedRanges[i];
            const next = mergedRanges[i + 1];
            if (current.max < next.min) {
                gaps.push({ min: current.max, max: next.min });
            }
        }

        // Gap after last range
        if (coveredMax < questionMaxScore) {
            gaps.push({ min: coveredMax, max: questionMaxScore });
        }

        // Check for out-of-bounds criteria
        const outOfBounds = parsedCriteria.filter(c =>
            c.parsed!.min < questionMinScore || c.parsed!.max > questionMaxScore
        );

        if (outOfBounds.length > 0) {
            warnings.push(`${outOfBounds.length} criteria extend beyond question score range`);
        }

        // Check for gaps
        if (gaps.length > 0) {
            warnings.push(`${gaps.length} gaps in score coverage`);
        }

        // Check for missing descriptions
        const missingDescriptions = criteria.filter(c => !c.description.trim());
        if (missingDescriptions.length > 0) {
            warnings.push(`${missingDescriptions.length} criteria missing descriptions`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            coverage: {
                coveredMin,
                coveredMax,
                gaps,
                overlaps
            }
        };
    }, [criteria, questionMinScore, questionMaxScore, parseScoreRange]);

    // Handle criterion field changes
    const handleCriterionChange = useCallback((
        criterionId: string,
        field: keyof ScoringCriterion,
        value: string
    ) => {
        let updates: Partial<ScoringCriterion> = {};

        if (field === 'scoreRange') {
            const parsedRange = parseScoreRange(value);
            if (parsedRange) {
                updates = {
                    scoreRange: value,
                    minPoints: parsedRange.min,
                    maxPoints: parsedRange.max
                };

                // Clear any range-specific errors
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[`${criterionId}-range`];
                    return newErrors;
                });
            } else if (value.trim()) {
                // Invalid format but not empty
                updates = { scoreRange: value };
                setErrors(prev => ({
                    ...prev,
                    [`${criterionId}-range`]: 'Invalid format. Use "5" or "3-5"'
                }));
            } else {
                // Empty value
                updates = { scoreRange: value };
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[`${criterionId}-range`];
                    return newErrors;
                });
            }
        } else {
            updates = { [field]: value };
        }

        onUpdateCriterion(criterionId, updates);
    }, [onUpdateCriterion, parseScoreRange]);

    // Generate suggested criteria based on common patterns
    const generateSuggestedCriteria = useCallback(() => {
        const range = questionMaxScore - questionMinScore;
        const suggestions: Array<{ scoreRange: string; description: string }> = [];

        if (range <= 5) {
            // For small ranges, suggest individual scores
            for (let i = questionMaxScore; i >= questionMinScore; i--) {
                let description = '';
                if (i === questionMaxScore) description = 'Excellent work';
                else if (i === questionMinScore) description = 'Needs improvement';
                else description = `${i === Math.ceil((questionMaxScore + questionMinScore) / 2) ? 'Good' : 'Fair'} work`;

                suggestions.push({
                    scoreRange: i.toString(),
                    description
                });
            }
        } else {
            // For larger ranges, suggest ranges
            const excellent = Math.ceil(questionMaxScore * 0.8);
            const good = Math.ceil(questionMaxScore * 0.6);
            const fair = Math.ceil(questionMaxScore * 0.4);

            suggestions.push(
                { scoreRange: `${excellent}-${questionMaxScore}`, description: 'Excellent work - exceeds expectations' },
                { scoreRange: `${good}-${excellent - 1}`, description: 'Good work - meets expectations' },
                { scoreRange: `${fair}-${good - 1}`, description: 'Fair work - partially meets expectations' },
                { scoreRange: `${questionMinScore}-${fair - 1}`, description: 'Needs improvement' }
            );
        }

        return suggestions;
    }, [questionMinScore, questionMaxScore]);

    const suggestedCriteria = useMemo(() => generateSuggestedCriteria(), [generateSuggestedCriteria]);

    // Add suggested criterion
    const addSuggestedCriterion = useCallback((suggestion: { scoreRange: string; description: string }) => {
        onAddCriterion();
        // The new criterion will be added with empty values, so we need to update it
        // This is a bit of a hack, but it works with the current architecture
        setTimeout(() => {
            const newCriterion = criteria[criteria.length - 1];
            if (newCriterion) {
                const parsedRange = parseScoreRange(suggestion.scoreRange);
                if (parsedRange) {
                    onUpdateCriterion(newCriterion.id, {
                        scoreRange: suggestion.scoreRange,
                        description: suggestion.description,
                        minPoints: parsedRange.min,
                        maxPoints: parsedRange.max
                    });
                }
            }
        }, 0);
    }, [onAddCriterion, criteria, onUpdateCriterion, parseScoreRange]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        Scoring Criteria
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                        Define score ranges and descriptions for this question ({questionMinScore}-{questionMaxScore} points)
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onAddCriterion}
                    className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none font-medium"
                    disabled={disabled}
                >
                    + Add Criterion
                </button>
            </div>

            {/* Validation Summary */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="rounded-md p-3 text-sm">
                    {validation.errors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-md p-2 mb-2">
                            <div className="flex items-center mb-1">
                                <svg className="w-4 h-4 text-red-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="font-medium text-red-800">Errors:</span>
                            </div>
                            <ul className="text-red-700 list-disc list-inside">
                                {validation.errors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validation.warnings.length > 0 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                            <div className="flex items-center mb-1">
                                <svg className="w-4 h-4 text-yellow-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span className="font-medium text-yellow-800">Warnings:</span>
                            </div>
                            <ul className="text-yellow-700 list-disc list-inside">
                                {validation.warnings.map((warning, index) => (
                                    <li key={index}>{warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Coverage Visualization */}
            {criteria.length > 0 && (
                <div className="bg-gray-50 rounded-md p-3">
                    <div className="text-sm font-medium text-gray-700 mb-2">Score Coverage</div>
                    <div className="relative h-6 bg-gray-200 rounded">
                        {/* Question range background */}
                        <div
                            className="absolute h-full bg-blue-100 rounded"
                            style={{
                                left: '0%',
                                width: '100%'
                            }}
                        />

                        {/* Covered ranges */}
                        {criteria.map(criterion => {
                            const parsed = parseScoreRange(criterion.scoreRange);
                            if (!parsed) return null;

                            const leftPercent = ((parsed.min - questionMinScore) / (questionMaxScore - questionMinScore)) * 100;
                            const widthPercent = ((parsed.max - parsed.min) / (questionMaxScore - questionMinScore)) * 100;

                            return (
                                <div
                                    key={criterion.id}
                                    className="absolute h-full bg-blue-500 opacity-70"
                                    style={{
                                        left: `${Math.max(0, leftPercent)}%`,
                                        width: `${Math.min(100 - Math.max(0, leftPercent), widthPercent)}%`
                                    }}
                                    title={`${criterion.scoreRange}: ${criterion.description}`}
                                />
                            );
                        })}

                        {/* Score markers */}
                        <div className="absolute inset-0 flex justify-between items-center px-1 text-xs text-gray-600">
                            <span>{questionMinScore}</span>
                            <span>{questionMaxScore}</span>
                        </div>
                    </div>

                    {/* Coverage stats */}
                    <div className="mt-2 text-xs text-gray-600">
                        Coverage: {validation.coverage.coveredMin.toFixed(1)} - {validation.coverage.coveredMax.toFixed(1)} points
                        {validation.coverage.gaps.length > 0 && (
                            <span className="text-yellow-600 ml-2">
                                • {validation.coverage.gaps.length} gap{validation.coverage.gaps.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {validation.coverage.overlaps.length > 0 && (
                            <span className="text-red-600 ml-2">
                                • {validation.coverage.overlaps.length} overlap{validation.coverage.overlaps.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Criteria List */}
            {criteria.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <svg className="w-8 h-8 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="text-sm text-gray-600 mb-3">No scoring criteria defined</p>

                    {/* Quick suggestions */}
                    <div className="space-y-2">
                        <p className="text-xs text-gray-500">Quick suggestions:</p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {suggestedCriteria.slice(0, 3).map((suggestion, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => addSuggestedCriterion(suggestion)}
                                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    disabled={disabled}
                                >
                                    {suggestion.scoreRange}: {suggestion.description}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onAddCriterion}
                        className="mt-3 text-sm text-blue-600 hover:text-blue-800 focus:outline-none font-medium"
                        disabled={disabled}
                    >
                        Or add custom criterion
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {criteria.map((criterion, index) => (
                        <CriterionEditor
                            key={criterion.id}
                            criterion={criterion}
                            index={index}
                            onChange={(field, value) => handleCriterionChange(criterion.id, field, value)}
                            onRemove={() => onRemoveCriterion(criterion.id)}
                            errors={errors}
                            disabled={disabled}
                            questionMinScore={questionMinScore}
                            questionMaxScore={questionMaxScore}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Individual Criterion Editor
interface CriterionEditorProps {
    criterion: ScoringCriterion;
    index: number;
    onChange: (field: keyof ScoringCriterion, value: string) => void;
    onRemove: () => void;
    errors: Record<string, string>;
    disabled: boolean;
    questionMinScore: number;
    questionMaxScore: number;
}

const CriterionEditor: React.FC<CriterionEditorProps> = ({
    criterion,
    index,
    onChange,
    onRemove,
    errors,
    disabled,
    questionMinScore,
    questionMaxScore
}) => {
    const hasError = errors[`${criterion.id}-range`];

    // Check if criterion is out of bounds
    const isOutOfBounds = criterion.minPoints < questionMinScore || criterion.maxPoints > questionMaxScore;

    return (
        <div className={`flex items-start space-x-2 p-3 bg-white border rounded-md ${hasError ? 'border-red-300 bg-red-50' : isOutOfBounds ? 'border-yellow-300 bg-yellow-50' : 'border-gray-200'
            }`}>
            <div className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600 mt-1">
                {index + 1}
            </div>

            <div className="flex-1 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                    <div>
                        <input
                            type="text"
                            value={criterion.scoreRange}
                            onChange={(e) => onChange('scoreRange', e.target.value)}
                            className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${hasError ? 'border-red-300' : 'border-gray-300'
                                }`}
                            placeholder="e.g., 8-10"
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

                {/* Error or warning messages */}
                {hasError && (
                    <p className="text-xs text-red-600">{hasError}</p>
                )}
                {!hasError && isOutOfBounds && (
                    <p className="text-xs text-yellow-600">
                        Score range extends beyond question bounds ({questionMinScore}-{questionMaxScore})
                    </p>
                )}
            </div>

            <button
                type="button"
                onClick={onRemove}
                className="text-red-600 hover:text-red-800 focus:outline-none p-1 mt-1"
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