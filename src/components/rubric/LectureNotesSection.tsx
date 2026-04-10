import React, { useState } from 'react';
import { BookOpen, Upload, X, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { LectureNote } from '../../types';

const GRADING_API = 'http://localhost:5000';

async function uploadNoteToBackend(noteId: string, file: File, rubricId?: string): Promise<string | null> {
    try {
        const formData = new FormData();
        formData.append('file', file);
        if (rubricId) formData.append('associate_with_rubric', rubricId);
        const res = await fetch(`${GRADING_API}/api/lecture-notes/upload`, { method: 'POST', body: formData });
        if (res.ok) {
            const data = await res.json();
            return data.data?.id ?? null;
        }
    } catch { /* backend unavailable — continue with metadata only */ }
    return null;
}

interface LectureNotesSectionProps {
    onNotesChange?: (notes: LectureNote[]) => void;
    disabled?: boolean;
    rubricId?: string;
    initialNotes?: LectureNote[];
}

export function LectureNotesSection({ onNotesChange, disabled, rubricId, initialNotes = [] }: LectureNotesSectionProps) {
    const [notes, setNotes] = useState<LectureNote[]>(initialNotes);
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleFileSelect = async (files: FileList | null) => {
        if (!files || files.length === 0) return;

        setUploading(true);
        const newNotes: LectureNote[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const noteId = `note-${Date.now()}-${i}`;

            const backendId = await uploadNoteToBackend(noteId, file, rubricId);

            if (backendId === null) {
                console.warn(`Backend upload failed for: ${file.name}, adding metadata only`);
            }

            // Always create the note metadata regardless of storage success
            const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
            const validFileType = ['pdf', 'docx', 'txt', 'md'].includes(fileExtension)
                ? fileExtension as 'pdf' | 'docx' | 'txt' | 'md'
                : 'pdf';

            const note: LectureNote = {
                id: noteId,
                backendId: backendId ?? undefined, // Persist backend UUID so file survives page refresh
                filename: file.name,
                originalName: file.name,
                fileSize: file.size,
                fileType: validFileType,
                uploadedAt: new Date(),
                associatedRubrics: [],
                metadata: {
                    processingStatus: 'completed',
                },
            };

            newNotes.push(note);
        }

        const updatedNotes = [...notes, ...newNotes];
        setNotes(updatedNotes);

        console.log('=== LectureNotesSection onNotesChange ===');
        console.log('notes before:', notes.length, 'new:', newNotes.length, 'total:', updatedNotes.length);

        if (onNotesChange) {
            onNotesChange(updatedNotes);
        }
        setUploading(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const removeNote = (noteId: string) => {
        const updatedNotes = notes.filter(n => n.id !== noteId);
        setNotes(updatedNotes);

        if (onNotesChange) {
            onNotesChange(updatedNotes);
        }
    };

    return (
        <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="size-5 text-blue-600" />
                    <div>
                        <h4 className="font-medium text-blue-900">
                            Lecture Notes & Reference Materials (Optional)
                        </h4>
                        <p className="text-sm text-blue-700">
                            Upload PDFs, DOCX, or TXT files to help AI understand the context for grading
                        </p>
                    </div>
                </div>

                {/* Upload Area */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`
                        border-2 border-dashed rounded-lg p-6 text-center transition-colors
                        ${isDragging ? 'border-blue-500 bg-blue-100' : 'border-blue-300 bg-white'}
                        ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400'}
                    `}
                >
                    <input
                        type="file"
                        id="lecture-notes-upload"
                        multiple
                        accept=".pdf,.docx,.txt,.md"
                        onChange={(e) => handleFileSelect(e.target.files)}
                        className="hidden"
                        disabled={disabled || uploading}
                    />

                    <label
                        htmlFor="lecture-notes-upload"
                        className={`flex flex-col items-center gap-2 ${disabled || uploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                        {uploading ? (
                            <>
                                <div className="size-8 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                                <p className="text-sm font-medium text-blue-700">Uploading & indexing...</p>
                            </>
                        ) : (
                            <>
                                <Upload className="size-8 text-blue-500" />
                                <div>
                                    <p className="text-sm font-medium text-gray-700">
                                        Drop files here or click to browse
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Supports PDF, DOCX, TXT, MD (max 50MB each)
                                    </p>
                                </div>
                            </>
                        )}
                    </label>
                </div>

                {/* Uploaded Files List */}
                {notes.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <h5 className="text-sm font-medium text-blue-900">
                            Uploaded Files ({notes.length}):
                        </h5>
                        <div className="space-y-2">
                            {notes.map((note) => (
                                <div
                                    key={note.id}
                                    className="flex items-center justify-between p-3 bg-white rounded border border-blue-200"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <FileText className="size-4 text-blue-600 flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                                {note.originalName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {note.fileType.toUpperCase()} • {(note.fileSize / 1024).toFixed(1)} KB
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeNote(note.id)}
                                        disabled={disabled}
                                        className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {notes.length === 0 && (
                    <p className="text-xs text-blue-600 mt-3 text-center">
                        💡 Tip: Adding lecture notes helps the AI provide more accurate and context-aware grading
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
