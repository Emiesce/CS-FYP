import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Eye, Edit, Trash2, Calendar, BookOpen, FileText } from 'lucide-react';
import { RubricData } from '../../types';

interface RubricCardProps {
    rubric: RubricData;
    onEdit: (rubric: RubricData) => void;
    onDelete: (rubricId: string) => void;
    onView: (rubric: RubricData) => void;
    courseName?: string;
    assignmentName?: string;
}

export function RubricCard({
    rubric,
    onEdit,
    onDelete,
    onView,
    courseName,
    assignmentName
}: RubricCardProps) {
    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(date));
    };

    const totalQuestions = rubric.questions.length;
    const pointsRange = `${rubric.totalMinPoints}-${rubric.totalMaxPoints}`;

    return (
        <Card className="p-6 hover:shadow-lg transition-all duration-200 border border-gray-200">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <h3 className="text-xl font-semibold text-[#2c2828] mb-2 line-clamp-2">
                        {rubric.title}
                    </h3>
                    {rubric.description && (
                        <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                            {rubric.description}
                        </p>
                    )}
                </div>
            </div>

            {/* Rubric Stats */}
            <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText className="w-4 h-4" />
                        <span>{totalQuestions} question{totalQuestions !== 1 ? 's' : ''}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                        {pointsRange} pts
                    </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>Created {formatDate(rubric.createdAt)}</span>
                </div>

                {/* Assignment Association */}
                {(courseName || assignmentName) && (
                    <div className="space-y-1">
                        {courseName && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <BookOpen className="w-4 h-4" />
                                <span className="truncate">{courseName}</span>
                            </div>
                        )}
                        {assignmentName && (
                            <div className="flex items-center gap-2 text-sm text-blue-600">
                                <span className="text-xs">→</span>
                                <span className="truncate font-medium">{assignmentName}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView(rubric)}
                    className="flex-1 flex items-center gap-2"
                >
                    <Eye className="w-4 h-4" />
                    View
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(rubric)}
                    className="flex-1 flex items-center gap-2"
                >
                    <Edit className="w-4 h-4" />
                    Edit
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(rubric.id)}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                    <Trash2 className="w-4 h-4" />
                    Delete
                </Button>
            </div>
        </Card>
    );
}