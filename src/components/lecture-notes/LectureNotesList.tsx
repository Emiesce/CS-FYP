import React, { useState } from 'react';
import { File, Trash2, Eye, Link, Calendar, FileText, HardDrive, AlertCircle, CheckCircle, Clock, BookOpen } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { LectureNote, RubricData } from '../../types';

interface LectureNotesListProps {
    notes: LectureNote[];
    rubrics?: RubricData[];
    onView: (note: LectureNote) => void;
    onDelete: (noteId: string) => void;
    onAssociate: (noteId: string) => void;
    loading?: boolean;
    emptyMessage?: string;
    className?: string;
}

export function LectureNotesList({
    notes,
    rubrics = [],
    onView,
    onDelete,
    onAssociate,
    loading = false,
    emptyMessage = 'No lecture notes uploaded yet',
    className
}: LectureNotesListProps) {
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (date: Date): string => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getFileTypeIcon = (fileType: string) => {
        switch (fileType) {
            case 'pdf':
                return <FileText className="size-5 text-red-500" />;
            case 'docx':
                return <FileText className="size-5 text-blue-500" />;
            case 'txt':
                return <File className="size-5 text-gray-500" />;
            case 'md':
                return <FileText className="size-5 text-purple-500" />;
            default:
                return <File className="size-5 text-gray-500" />;
        }
    };

    const getProcessingStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <div className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                        <Clock className="size-3" />
                        <span>Pending</span>
                    </div>
                );
            case 'processing':
                return (
                    <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        <Clock className="size-3 animate-spin" />
                        <span>Processing</span>
                    </div>
                );
            case 'completed':
                return (
                    <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                        <CheckCircle className="size-3" />
                        <span>Completed</span>
                    </div>
                );
            case 'failed':
                return (
                    <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        <AlertCircle className="size-3" />
                        <span>Failed</span>
                    </div>
                );
            default:
                return null;
        }
    };

    const getRubricNames = (rubricIds: string[]): string => {
        if (rubricIds.length === 0) return 'None';

        const names = rubricIds
            .map(id => rubrics.find(r => r.id === id)?.title || 'Unknown')
            .slice(0, 2);

        if (rubricIds.length > 2) {
            return `${names.join(', ')} +${rubricIds.length - 2} more`;
        }

        return names.join(', ');
    };

    const handleDelete = async (noteId: string) => {
        if (window.confirm('Are you sure you want to delete this lecture note? This action cannot be undone.')) {
            setDeletingNoteId(noteId);
            try {
                await onDelete(noteId);
            } finally {
                setDeletingNoteId(null);
            }
        }
    };

    if (loading) {
        return (
            <div className={cn("space-y-4", className)}>
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-6">
                            <div className="space-y-3">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <Card className={cn("border-dashed", className)}>
                <CardContent className="p-12">
                    <div className="flex flex-col items-center justify-center text-center space-y-4">
                        <div className="p-4 rounded-full bg-gray-100">
                            <BookOpen className="size-8 text-gray-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium text-gray-900">
                                {emptyMessage}
                            </h3>
                            <p className="text-sm text-gray-600">
                                Upload lecture notes and materials to enhance AI grading with course-specific context
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}>
            {notes.map((note) => (
                <Card
                    key={note.id}
                    className={cn(
                        "hover:shadow-md transition-shadow",
                        note.metadata.processingStatus === 'failed' && "border-red-200"
                    )}
                >
                    <CardContent className="p-6">
                        {/* Header with file icon and status */}
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {getFileTypeIcon(note.fileType)}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-medium text-gray-900 truncate" title={note.originalName}>
                                        {note.originalName}
                                    </h3>
                                    <p className="text-xs text-gray-500 uppercase mt-0.5">
                                        {note.fileType}
                                    </p>
                                </div>
                            </div>
                            {getProcessingStatusBadge(note.metadata.processingStatus)}
                        </div>

                        {/* Metadata */}
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <HardDrive className="size-3" />
                                <span>{formatFileSize(note.fileSize)}</span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-600">
                                <Calendar className="size-3" />
                                <span>Uploaded {formatDate(note.uploadedAt)}</span>
                            </div>

                            {note.wordCount !== undefined && (
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <FileText className="size-3" />
                                    <span>{note.wordCount.toLocaleString()} words</span>
                                </div>
                            )}

                            {note.metadata.pageCount !== undefined && (
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                    <FileText className="size-3" />
                                    <span>{note.metadata.pageCount} pages</span>
                                </div>
                            )}
                        </div>

                        {/* Associated Rubrics */}
                        <div className="mb-4 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                                <Link className="size-3" />
                                <span className="font-medium">Associated Rubrics:</span>
                            </div>
                            <p className="text-xs text-gray-700 pl-5">
                                {getRubricNames(note.associatedRubrics)}
                            </p>
                        </div>

                        {/* Error Message */}
                        {note.metadata.processingStatus === 'failed' && note.metadata.processingError && (
                            <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="size-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-red-700">
                                        {note.metadata.processingError}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onView(note)}
                                className="flex-1"
                                disabled={note.metadata.processingStatus === 'processing'}
                            >
                                <Eye className="size-4 mr-1" />
                                View
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onAssociate(note.id)}
                                className="flex-1"
                                disabled={note.metadata.processingStatus === 'processing'}
                            >
                                <Link className="size-4 mr-1" />
                                Associate
                            </Button>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(note.id)}
                                disabled={deletingNoteId === note.id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
