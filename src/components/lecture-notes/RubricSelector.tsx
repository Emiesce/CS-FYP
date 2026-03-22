import React, { useState, useEffect } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';
import { RubricData } from '../../types';

interface RubricSelectorProps {
    rubrics: RubricData[];
    selectedRubricIds: string[];
    onSelectionChange: (rubricIds: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
    multiple?: boolean;
    className?: string;
    maxSelections?: number;
}

export function RubricSelector({
    rubrics,
    selectedRubricIds,
    onSelectionChange,
    placeholder = "Select rubrics to associate...",
    disabled = false,
    multiple = true,
    className,
    maxSelections
}: RubricSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Filter rubrics based on search term
    const filteredRubrics = rubrics.filter(rubric =>
        rubric.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rubric.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get selected rubrics for display
    const selectedRubrics = rubrics.filter(rubric =>
        selectedRubricIds.includes(rubric.id)
    );

    // Handle rubric selection
    const handleRubricToggle = (rubricId: string) => {
        if (disabled) return;

        if (multiple) {
            const isSelected = selectedRubricIds.includes(rubricId);
            let newSelection: string[];

            if (isSelected) {
                // Remove from selection
                newSelection = selectedRubricIds.filter(id => id !== rubricId);
            } else {
                // Add to selection (check max limit)
                if (maxSelections && selectedRubricIds.length >= maxSelections) {
                    return; // Don't add if at max limit
                }
                newSelection = [...selectedRubricIds, rubricId];
            }

            onSelectionChange(newSelection);
        } else {
            // Single selection mode
            const newSelection = selectedRubricIds.includes(rubricId) ? [] : [rubricId];
            onSelectionChange(newSelection);
            setIsOpen(false);
        }
    };

    // Handle removing a selected rubric
    const handleRemoveRubric = (rubricId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        if (disabled) return;

        const newSelection = selectedRubricIds.filter(id => id !== rubricId);
        onSelectionChange(newSelection);
    };

    // Clear all selections
    const handleClearAll = (event: React.MouseEvent) => {
        event.stopPropagation();
        if (disabled) return;
        onSelectionChange([]);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('[data-rubric-selector]')) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Format display text
    const getDisplayText = () => {
        if (selectedRubrics.length === 0) {
            return placeholder;
        }

        if (selectedRubrics.length === 1) {
            return selectedRubrics[0].title;
        }

        return `${selectedRubrics.length} rubrics selected`;
    };

    return (
        <div className={cn("relative", className)} data-rubric-selector>
            {/* Main selector button */}
            <Button
                variant="outline"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "w-full justify-between text-left font-normal",
                    selectedRubrics.length === 0 && "text-muted-foreground",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <span className="truncate">{getDisplayText()}</span>
                <ChevronDown className={cn(
                    "size-4 transition-transform",
                    isOpen && "rotate-180"
                )} />
            </Button>

            {/* Selected rubrics display (for multiple selection) */}
            {multiple && selectedRubrics.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {selectedRubrics.map(rubric => (
                        <div
                            key={rubric.id}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
                        >
                            <span className="truncate max-w-32">{rubric.title}</span>
                            {!disabled && (
                                <button
                                    onClick={(e) => handleRemoveRubric(rubric.id, e)}
                                    className="hover:bg-blue-200 rounded p-0.5"
                                >
                                    <X className="size-3" />
                                </button>
                            )}
                        </div>
                    ))}
                    {selectedRubrics.length > 1 && !disabled && (
                        <button
                            onClick={handleClearAll}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md hover:bg-gray-200"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            )}

            {/* Dropdown */}
            {isOpen && (
                <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-hidden">
                    <CardContent className="p-0">
                        {/* Search input */}
                        <div className="p-3 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search rubrics..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        {/* Rubrics list */}
                        <div className="max-h-60 overflow-y-auto">
                            {filteredRubrics.length === 0 ? (
                                <div className="p-4 text-center text-gray-500 text-sm">
                                    {searchTerm ? 'No rubrics match your search' : 'No rubrics available'}
                                </div>
                            ) : (
                                <div className="py-1">
                                    {filteredRubrics.map(rubric => {
                                        const isSelected = selectedRubricIds.includes(rubric.id);
                                        const isDisabled = Boolean(maxSelections &&
                                            !isSelected &&
                                            selectedRubricIds.length >= maxSelections);

                                        return (
                                            <button
                                                key={rubric.id}
                                                onClick={() => handleRubricToggle(rubric.id)}
                                                disabled={isDisabled}
                                                className={cn(
                                                    "w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 transition-colors",
                                                    isSelected && "bg-blue-50",
                                                    isDisabled && "opacity-50 cursor-not-allowed"
                                                )}
                                            >
                                                {/* Checkbox/check indicator */}
                                                <div className={cn(
                                                    "flex-shrink-0 w-4 h-4 border rounded mt-0.5 flex items-center justify-center",
                                                    isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300"
                                                )}>
                                                    {isSelected && (
                                                        <Check className="size-3 text-white" />
                                                    )}
                                                </div>

                                                {/* Rubric info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm truncate">
                                                        {rubric.title}
                                                    </div>
                                                    {rubric.description && (
                                                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                            {rubric.description}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        {rubric.questions.length} question{rubric.questions.length !== 1 ? 's' : ''} •
                                                        {rubric.totalMinPoints}-{rubric.totalMaxPoints} points
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer with selection info */}
                        {multiple && (
                            <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
                                {selectedRubricIds.length} of {rubrics.length} rubrics selected
                                {maxSelections && ` (max ${maxSelections})`}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}