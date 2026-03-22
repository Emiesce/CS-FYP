import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { LectureNotesUpload } from '../lecture-notes/LectureNotesUpload';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { LectureNote, RubricData } from '../../types';

interface RubricWithLectureNotesProps {
    rubricId?: string;
    rubricTitle?: string;
    onLectureNotesUpload?: (notes: LectureNote[]) => void;
    className?: string;
}

export function RubricWithLectureNotes({
    rubricId,
    rubricTitle,
    onLectureNotesUpload,
    className
}: RubricWithLectureNotesProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [uploadedNotes, setUploadedNotes] = useState<LectureNote[]>([]);

    const handleFileUpload = async (file: File, associateWithRubric?: string) => {
        try {
            // TODO: Implement actual upload to backend
            // For now, create a mock lecture note
            const mockNote: LectureNote = {
                id: `note-${Date.now()}`,
                filename: file.name,
                originalName: file.name,
                fileSize: file.size,
                fileType: file.name.split('.').pop() || 'unknown',
                uploadedAt: new Date(),
                associatedRubrics: rubricId ? [rubricId] : [],
                metadata: {
                    processingStatus: 'completed',
                },
            };

            const newNotes = [...uploadedNotes, mockNote];
            setUploadedNotes(newNotes);

            if (onLectureNotesUpload) {
                onLectureNotesUpload(newNotes);
            }

            console.log('Lecture note uploaded:', mockNote);
        } catch (error) {
            console.error('Error uploading lecture note:', error);
            throw error;
        }
    };

    return (
        <div className={className}>
            <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="size-5 text-blue-600" />
                            <div>
                                <h4 className="font-medium text-blue-900">
                                    Lecture Notes & Reference Materials
                                </h4>
                                <p className="text-sm text-blue-700">
                                    Upload relevant materials to help AI grade this rubric
                                    {uploadedNotes.length > 0 && ` (${uploadedNotes.length} uploaded)`}
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="text-blue-600 hover:text-blue-800"
                        >
                            {isExpanded ? (
                                <ChevronUp className="size-5" />
                            ) : (
                                <ChevronDown className="size-5" />
                            )}
                        </Button>
                    </div>

                    {isExpanded && (
                        <div className="mt-4">
                            <LectureNotesUpload
                                onFileUpload={handleFileUpload}
                                uploadedNotes={uploadedNotes}
                                currentRubricId={rubricId}
                                maxFileSize={50}
                                acceptedFormats={['.pdf', '.docx', '.txt', '.md']}
                                className="bg-white"
                            />

                            {uploadedNotes.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    <h5 className="text-sm font-medium text-blue-900">
                                        Uploaded Materials:
                                    </h5>
                                    <div className="space-y-1">
                                        {uploadedNotes.map((note) => (
                                            <div
                                                key={note.id}
                                                className="flex items-center justify-between p-2 bg-white rounded border border-blue-200"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <BookOpen className="size-4 text-blue-600" />
                                                    <span className="text-sm text-gray-700">
                                                        {note.originalName}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-gray-500">
                                                    {(note.fileSize / 1024).toFixed(1)} KB
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
