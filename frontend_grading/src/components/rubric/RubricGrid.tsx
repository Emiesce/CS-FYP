import React, { useState, useMemo } from 'react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Search, Filter, X, Calendar, BookOpen, FileText } from 'lucide-react';
import { RubricData, Course, Assignment } from '../../types';
import { RubricCard } from './RubricCard';

interface RubricGridProps {
    rubrics: RubricData[];
    courses?: Course[];
    assignments?: Assignment[];
    onEdit: (rubric: RubricData) => void;
    onDelete: (rubricId: string) => void;
    onView: (rubric: RubricData) => void;
    loading?: boolean;
}

interface FilterState {
    search: string;
    courseId: string;
    assignmentId: string;
    dateRange: 'all' | 'week' | 'month' | 'year';
}

export function RubricGrid({
    rubrics,
    courses = [],
    assignments = [],
    onEdit,
    onDelete,
    onView,
    loading = false
}: RubricGridProps) {
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        courseId: '',
        assignmentId: '',
        dateRange: 'all'
    });
    const [showFilters, setShowFilters] = useState(false);

    // Filter rubrics based on current filters
    const filteredRubrics = useMemo(() => {
        let filtered = [...rubrics];

        // Search filter
        if (filters.search.trim()) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(rubric =>
                rubric.title.toLowerCase().includes(searchTerm) ||
                rubric.description.toLowerCase().includes(searchTerm)
            );
        }

        // Course filter
        if (filters.courseId) {
            filtered = filtered.filter(rubric => rubric.courseId === filters.courseId);
        }

        // Assignment filter
        if (filters.assignmentId) {
            filtered = filtered.filter(rubric => rubric.assignmentId === filters.assignmentId);
        }

        // Date range filter
        if (filters.dateRange !== 'all') {
            const now = new Date();
            const cutoffDate = new Date();

            switch (filters.dateRange) {
                case 'week':
                    cutoffDate.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    cutoffDate.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    cutoffDate.setFullYear(now.getFullYear() - 1);
                    break;
            }

            filtered = filtered.filter(rubric =>
                new Date(rubric.createdAt) >= cutoffDate
            );
        }

        return filtered;
    }, [rubrics, filters]);

    const clearFilters = () => {
        setFilters({
            search: '',
            courseId: '',
            assignmentId: '',
            dateRange: 'all'
        });
    };

    const hasActiveFilters = filters.search || filters.courseId || filters.assignmentId || filters.dateRange !== 'all';

    const getCourseName = (courseId?: string) => {
        if (!courseId) return undefined;
        return courses.find(c => c.id === courseId)?.name;
    };

    const getAssignmentName = (assignmentId?: string) => {
        if (!assignmentId) return undefined;
        return assignments.find(a => a.id === assignmentId)?.title;
    };

    if (loading) {
        return (
            <div className="space-y-4">
                {/* Loading skeleton */}
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                        <div className="h-6 bg-gray-200 rounded mb-3 w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded mb-2 w-full"></div>
                        <div className="h-4 bg-gray-200 rounded mb-4 w-2/3"></div>
                        <div className="flex gap-2">
                            <div className="h-8 bg-gray-200 rounded w-16"></div>
                            <div className="h-8 bg-gray-200 rounded w-16"></div>
                            <div className="h-8 bg-gray-200 rounded w-16"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Search and Filter Controls */}
            <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative flex items-center">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
                    <Input
                        placeholder="Search rubrics by name or description..."
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        className="pl-10 pr-4 w-full"
                    />
                </div>

                {/* Filter Toggle and Active Filters */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFilters(!showFilters)}
                            className="flex items-center gap-2"
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            {hasActiveFilters && (
                                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                                    {[filters.courseId, filters.assignmentId, filters.dateRange !== 'all' ? 1 : 0, filters.search ? 1 : 0]
                                        .filter(Boolean).length}
                                </Badge>
                            )}
                        </Button>

                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                                className="flex items-center gap-1 text-gray-600"
                            >
                                <X className="w-3 h-3" />
                                Clear
                            </Button>
                        )}
                    </div>

                    <div className="text-sm text-gray-600">
                        {filteredRubrics.length} of {rubrics.length} rubrics
                    </div>
                </div>

                {/* Expanded Filters */}
                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border">
                        {/* Course Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <BookOpen className="w-4 h-4 inline mr-1" />
                                Course
                            </label>
                            <select
                                value={filters.courseId}
                                onChange={(e) => setFilters(prev => ({ ...prev, courseId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Courses</option>
                                {courses.map(course => (
                                    <option key={course.id} value={course.id}>
                                        {course.name} ({course.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Assignment Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <FileText className="w-4 h-4 inline mr-1" />
                                Assignment
                            </label>
                            <select
                                value={filters.assignmentId}
                                onChange={(e) => setFilters(prev => ({ ...prev, assignmentId: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">All Assignments</option>
                                {assignments
                                    .filter(assignment => !filters.courseId || assignment.courseId === filters.courseId)
                                    .map(assignment => (
                                        <option key={assignment.id} value={assignment.id}>
                                            {assignment.title}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Date Range Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Created
                            </label>
                            <select
                                value={filters.dateRange}
                                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as FilterState['dateRange'] }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">All Time</option>
                                <option value="week">Past Week</option>
                                <option value="month">Past Month</option>
                                <option value="year">Past Year</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Results */}
            {filteredRubrics.length === 0 ? (
                <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {hasActiveFilters ? 'No rubrics match your filters' : 'No rubrics found'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                        {hasActiveFilters
                            ? 'Try adjusting your search criteria or clearing filters.'
                            : 'Create your first rubric by uploading a file or using the manual form.'
                        }
                    </p>
                    {hasActiveFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                            Clear Filters
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRubrics.map(rubric => (
                        <RubricCard
                            key={rubric.id}
                            rubric={rubric}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onView={onView}
                            courseName={getCourseName(rubric.courseId)}
                            assignmentName={getAssignmentName(rubric.assignmentId)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}