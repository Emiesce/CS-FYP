import React, { useState, useMemo } from 'react';
import { Search, Filter, X, Calendar, FileType, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { LectureNote, RubricData } from '../../types';

interface LectureNotesSearchProps {
    notes: LectureNote[];
    rubrics?: RubricData[];
    onFilteredNotesChange: (filteredNotes: LectureNote[]) => void;
    className?: string;
}

interface SearchFilters {
    searchQuery: string;
    fileTypes: string[];
    rubricIds: string[];
    dateRange: {
        start: string;
        end: string;
    };
    processingStatus: string[];
}

export function LectureNotesSearch({
    notes,
    rubrics = [],
    onFilteredNotesChange,
    className
}: LectureNotesSearchProps) {
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({
        searchQuery: '',
        fileTypes: [],
        rubricIds: [],
        dateRange: {
            start: '',
            end: ''
        },
        processingStatus: []
    });

    const availableFileTypes = useMemo(() => {
        const types = new Set(notes.map(note => note.fileType));
        return Array.from(types).sort();
    }, [notes]);

    const availableStatuses = ['pending', 'processing', 'completed', 'failed'];

    // Filter and search logic
    const filteredNotes = useMemo(() => {
        let result = [...notes];

        // Text search across filename and content
        if (filters.searchQuery.trim()) {
            const query = filters.searchQuery.toLowerCase();
            result = result.filter(note => {
                const matchesFilename = note.originalName.toLowerCase().includes(query);
                const matchesContent = note.extractedContent?.toLowerCase().includes(query);
                return matchesFilename || matchesContent;
            });
        }

        // Filter by file type
        if (filters.fileTypes.length > 0) {
            result = result.filter(note => filters.fileTypes.includes(note.fileType));
        }

        // Filter by rubric association
        if (filters.rubricIds.length > 0) {
            result = result.filter(note =>
                note.associatedRubrics.some(rubricId => filters.rubricIds.includes(rubricId))
            );
        }

        // Filter by date range
        if (filters.dateRange.start) {
            const startDate = new Date(filters.dateRange.start);
            result = result.filter(note => new Date(note.uploadedAt) >= startDate);
        }
        if (filters.dateRange.end) {
            const endDate = new Date(filters.dateRange.end);
            endDate.setHours(23, 59, 59, 999); // Include the entire end date
            result = result.filter(note => new Date(note.uploadedAt) <= endDate);
        }

        // Filter by processing status
        if (filters.processingStatus.length > 0) {
            result = result.filter(note =>
                filters.processingStatus.includes(note.metadata.processingStatus)
            );
        }

        return result;
    }, [notes, filters]);

    // Update parent component when filtered notes change
    React.useEffect(() => {
        onFilteredNotesChange(filteredNotes);
    }, [filteredNotes, onFilteredNotesChange]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, searchQuery: e.target.value }));
    };

    const toggleFileType = (fileType: string) => {
        setFilters(prev => ({
            ...prev,
            fileTypes: prev.fileTypes.includes(fileType)
                ? prev.fileTypes.filter(t => t !== fileType)
                : [...prev.fileTypes, fileType]
        }));
    };

    const toggleRubric = (rubricId: string) => {
        setFilters(prev => ({
            ...prev,
            rubricIds: prev.rubricIds.includes(rubricId)
                ? prev.rubricIds.filter(id => id !== rubricId)
                : [...prev.rubricIds, rubricId]
        }));
    };

    const toggleStatus = (status: string) => {
        setFilters(prev => ({
            ...prev,
            processingStatus: prev.processingStatus.includes(status)
                ? prev.processingStatus.filter(s => s !== status)
                : [...prev.processingStatus, status]
        }));
    };

    const handleDateChange = (field: 'start' | 'end', value: string) => {
        setFilters(prev => ({
            ...prev,
            dateRange: {
                ...prev.dateRange,
                [field]: value
            }
        }));
    };

    const clearAllFilters = () => {
        setFilters({
            searchQuery: '',
            fileTypes: [],
            rubricIds: [],
            dateRange: { start: '', end: '' },
            processingStatus: []
        });
    };

    const hasActiveFilters =
        filters.searchQuery.trim() !== '' ||
        filters.fileTypes.length > 0 ||
        filters.rubricIds.length > 0 ||
        filters.dateRange.start !== '' ||
        filters.dateRange.end !== '' ||
        filters.processingStatus.length > 0;

    const activeFilterCount =
        (filters.searchQuery.trim() ? 1 : 0) +
        filters.fileTypes.length +
        filters.rubricIds.length +
        (filters.dateRange.start ? 1 : 0) +
        (filters.dateRange.end ? 1 : 0) +
        filters.processingStatus.length;

    return (
        <div className={cn("space-y-4", className)}>
            {/* Search Bar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search lecture notes by filename or content..."
                        value={filters.searchQuery}
                        onChange={handleSearchChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {filters.searchQuery && (
                        <button
                            onClick={() => setFilters(prev => ({ ...prev, searchQuery: '' }))}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>

                <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className={cn(
                        "relative",
                        hasActiveFilters && "border-blue-500 text-blue-600"
                    )}
                >
                    <Filter className="size-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                            {activeFilterCount}
                        </span>
                    )}
                </Button>

                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        onClick={clearAllFilters}
                        className="text-gray-600 hover:text-gray-800"
                    >
                        <X className="size-4 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <Card>
                    <CardContent className="p-4">
                        <div className="space-y-4">
                            {/* File Type Filter */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <FileType className="size-4 text-gray-600" />
                                    <label className="text-sm font-medium text-gray-700">
                                        File Type
                                    </label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {availableFileTypes.map(fileType => (
                                        <button
                                            key={fileType}
                                            onClick={() => toggleFileType(fileType)}
                                            className={cn(
                                                "px-3 py-1 text-sm rounded-full border transition-colors",
                                                filters.fileTypes.includes(fileType)
                                                    ? "bg-blue-500 text-white border-blue-500"
                                                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
                                            )}
                                        >
                                            {fileType.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Rubric Association Filter */}
                            {rubrics.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <LinkIcon className="size-4 text-gray-600" />
                                        <label className="text-sm font-medium text-gray-700">
                                            Associated Rubrics
                                        </label>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {rubrics.map(rubric => (
                                            <button
                                                key={rubric.id}
                                                onClick={() => toggleRubric(rubric.id)}
                                                className={cn(
                                                    "px-3 py-1 text-sm rounded-full border transition-colors",
                                                    filters.rubricIds.includes(rubric.id)
                                                        ? "bg-blue-500 text-white border-blue-500"
                                                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
                                                )}
                                            >
                                                {rubric.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Processing Status Filter */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Filter className="size-4 text-gray-600" />
                                    <label className="text-sm font-medium text-gray-700">
                                        Processing Status
                                    </label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {availableStatuses.map(status => (
                                        <button
                                            key={status}
                                            onClick={() => toggleStatus(status)}
                                            className={cn(
                                                "px-3 py-1 text-sm rounded-full border transition-colors capitalize",
                                                filters.processingStatus.includes(status)
                                                    ? "bg-blue-500 text-white border-blue-500"
                                                    : "bg-white text-gray-700 border-gray-300 hover:border-blue-500"
                                            )}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Date Range Filter */}
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Calendar className="size-4 text-gray-600" />
                                    <label className="text-sm font-medium text-gray-700">
                                        Upload Date Range
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">
                                            From
                                        </label>
                                        <input
                                            type="date"
                                            value={filters.dateRange.start}
                                            onChange={(e) => handleDateChange('start', e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600 mb-1 block">
                                            To
                                        </label>
                                        <input
                                            type="date"
                                            value={filters.dateRange.end}
                                            onChange={(e) => handleDateChange('end', e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Results Summary */}
            <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                    Showing {filteredNotes.length} of {notes.length} lecture note{notes.length !== 1 ? 's' : ''}
                </span>
                {hasActiveFilters && (
                    <span className="text-blue-600">
                        {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                    </span>
                )}
            </div>
        </div>
    );
}
