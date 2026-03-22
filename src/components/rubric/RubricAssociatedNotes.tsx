import React, { useState } from 'react';
import { BookOpen, Eye, Link, Unlink, FileText, Calendar, HardDrive, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { LectureNote } from '../../types';

interface RubricAssociatedNotesProps {
    rubricId: string;
    associatedNotes: LectureNote[];
    allNotes: LectureNote[];
    onAssociate: (noteId: string, rubricId: string) => Promise<void>;
    onDisassociate: (noteId: string, rubricId: string) => Promise<void>;
    onViewNote: (note: LectureNote) => void;
    loading?: boolean;
    className?: string;
}

export function RubricAssociatedNotes({
    rubricId,
    associatedNotes,
    allNotes,
    onAssociate,
    onDisassociate,
    onViewNote,
    loading = false,
    className
}: RubricAssociatedNotesProps) {
    const [showAssociateDialog, setShowAssociateDialog] = useState(false);
    const [processingNoteId, setProcessingNoteId] = useState<string | null>(null);

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
                return <FileText className="size-4 text-red-500" />;
            case 'docx':
                return <FileText className="size-4 text-blue-500" />;
            case 'txt':
                return <FileText className="size-4 text-gray-500" />;
            case 'md':
                return <FileText className="size-4 text-purple-500" />;
            default:
                return <FileText className="size-4 text-gray-500" />;
        }
    };

    const handleAssociate = async (noteId: string) => {
        setProcessingNoteId(noteId);
        try {
            await onAssociate(noteId, rubricId);
        } finally {
            setProcessingNoteId(null);
        }
    };

    const handleDisassociate = async (noteId: string) => {
        setProcessingNoteId(noteId);
        try {
            await onDisassociate(noteId, rubricId);
        } finally {
            setProcessingNoteId(null);
        }
    };

    // Get notes that are not yet associated
    const unassociatedNotes = allNotes.filter(
        note => !note.associatedRubrics.includes(rubricId)
    );

    if (loading) {
        return (
            <Card className={className}>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-6 animate-spin text-gray-400" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BookOpen className="size-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">
                            Associated Lecture Notes
                        </h3>
                        <Badge variant="outline">
                            {associatedNotes.length}
                        </Badge>
                    </div>
                    {unassociatedNotes.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAssociateDialog(!showAssociateDialog)}
                        >
                            <Link className="size-4 mr-1" />
                            {showAssociateDialog ? 'Hide' : 'Add Notes'}
                        </Button>
                    )}
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    These lecture notes will be included as context when grading with this rubric
                </p>

                {/* Associated Notes List */}
                {associatedNotes.length === 0 && !showAssociateDialog ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                        <BookOpen className="size-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                            No lecture notes associated yet
                        </p>
                        {unassociatedNotes.length > 0 && (
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => setShowAssociateDialog(true)}
                                className="mt-2"
                            >
                                Add lecture notes
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {associatedNotes.map(note => (
                            <div
                                key={note.id}
                                className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                            >
                                {getFileTypeIcon(note.fileType)}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-gray-900 truncate">
                                                {note.originalName}
                                            </h4>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <HardDrive className="size-3" />
                                                    {formatFileSize(note.fileSize)}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="size-3" />
                                                    {formatDate(note.uploadedAt)}
                                                </span>
                                                {note.wordCount && (
                                                    <span>{note.wordCount.toLocaleString()} words</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => onViewNote(note)}
                                                className="h-8 px-2"
                                            >
                                                <Eye className="size-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDisassociate(note.id)}
                                                disabled={processingNoteId === note.id}
                                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                            >
                                                {processingNoteId === note.id ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <Unlink className="size-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add Notes Dialog */}
                {showAssociateDialog && unassociatedNotes.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-medium text-gray-900 mb-3">
                            Available Lecture Notes
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {unassociatedNotes.map(note => (
                                <div
                                    key={note.id}
                                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                >
                                    {getFileTypeIcon(note.fileType)}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                                    {note.originalName}
                                                </h4>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span className="uppercase">{note.fileType}</span>
                                                    <span>{formatFileSize(note.fileSize)}</span>
                                                    {note.wordCount && (
                                                        <span>{note.wordCount.toLocaleString()} words</span>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleAssociate(note.id)}
                                                disabled={processingNoteId === note.id}
                                                className="h-8"
                                            >
                                                {processingNoteId === note.id ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Link className="size-4 mr-1" />
                                                        Add
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
