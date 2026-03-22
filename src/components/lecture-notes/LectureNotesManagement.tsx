import React, { useState, useCallback } from 'react';
import { Upload, List, Link, Search, BookOpen, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { LectureNote, RubricData } from '../../types';
import { LectureNotesUpload } from './LectureNotesUpload';
import { LectureNotesList } from './LectureNotesList';
import { LectureNotesAssociation } from './LectureNotesAssociation';
import { LectureNotesSearch } from './LectureNotesSearch';
import { LectureNotesPreview } from './LectureNotesPreview';

interface LectureNotesManagementProps {
    notes: LectureNote[];
    rubrics: RubricData[];
    onFileUpload: (file: File, associateWithRubric?: string) => Promise<void>;
    onBatchUpload?: (files: File[], associateWithRubrics?: string[]) => Promise<void>;
    onFileRemove: (noteId: string) => Promise<void>;
    onAssociate: (noteIds: string[], rubricIds: string[]) => Promise<void>;
    onDisassociate: (noteIds: string[], rubricIds: string[]) => Promise<void>;
    onRetryProcessing?: (noteId: string) => Promise<void>;
    loading?: boolean;
    className?: string;
}

type ViewMode = 'upload' | 'list' | 'associate' | 'search';

export function LectureNotesManagement({
    notes,
    rubrics,
    onFileUpload,
    onBatchUpload,
    onFileRemove,
    onAssociate,
    onDisassociate,
    onRetryProcessing,
    loading = false,
    className
}: LectureNotesManagementProps) {
    const [activeView, setActiveView] = useState<ViewMode>('list');
    const [selectedNote, setSelectedNote] = useState<LectureNote | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [filteredNotes, setFilteredNotes] = useState<LectureNote[]>(notes);

    // Clear messages after timeout
    const showMessage = useCallback((type: 'error' | 'success', message: string) => {
        if (type === 'error') {
            setError(message);
            setTimeout(() => setError(null), 5000);
        } else {
            setSuccess(message);
            setTimeout(() => setSuccess(null), 3000);
        }
    }, []);

    // Handle view note
    const handleViewNote = useCallback((note: LectureNote) => {
        setSelectedNote(note);
        setShowPreview(true);
    }, []);

    // Handle associate from list view
    const handleAssociateFromList = useCallback((noteId: string) => {
        setActiveView('associate');
        // Pre-select the note in association view
        const note = notes.find(n => n.id === noteId);
        if (note) {
            setSelectedNote(note);
        }
    }, [notes]);

    // Handle delete with error handling
    const handleDelete = useCallback(async (noteId: string) => {
        try {
            await onFileRemove(noteId);
            showMessage('success', 'Lecture note deleted successfully');
        } catch (error) {
            showMessage('error', error instanceof Error ? error.message : 'Failed to delete note');
        }
    }, [onFileRemove, showMessage]);

    // Handle upload with error handling
    const handleUpload = useCallback(async (file: File, associateWithRubric?: string) => {
        try {
            await onFileUpload(file, associateWithRubric);
            showMessage('success', `"${file.name}" uploaded successfully`);
        } catch (error) {
            showMessage('error', error instanceof Error ? error.message : 'Upload failed');
            throw error;
        }
    }, [onFileUpload, showMessage]);

    // Handle batch upload with error handling
    const handleBatchUpload = useCallback(async (files: File[], associateWithRubrics?: string[]) => {
        if (!onBatchUpload) return;

        try {
            await onBatchUpload(files, associateWithRubrics);
            showMessage('success', `${files.length} files uploaded successfully`);
        } catch (error) {
            showMessage('error', error instanceof Error ? error.message : 'Batch upload failed');
            throw error;
        }
    }, [onBatchUpload, showMessage]);

    // Handle association with error handling
    const handleAssociate = useCallback(async (noteIds: string[], rubricIds: string[]) => {
        try {
            await onAssociate(noteIds, rubricIds);
            showMessage('success', 'Association created successfully');
        } catch (error) {
            showMessage('error', error instanceof Error ? error.message : 'Association failed');
            throw error;
        }
    }, [onAssociate, showMessage]);

    // Handle disassociation with error handling
    const handleDisassociate = useCallback(async (noteIds: string[], rubricIds: string[]) => {
        try {
            await onDisassociate(noteIds, rubricIds);
            showMessage('success', 'Association removed successfully');
        } catch (error) {
            showMessage('error', error instanceof Error ? error.message : 'Disassociation failed');
            throw error;
        }
    }, [onDisassociate, showMessage]);

    // Handle retry processing with error handling
    const handleRetryProcessing = useCallback(async (noteId: string) => {
        if (!onRetryProcessing) {
            showMessage('error', 'Retry functionality not available');
            return;
        }

        try {
            await onRetryProcessing(noteId);
            showMessage('success', 'Processing retry initiated');
            setShowPreview(false);
        } catch (error) {
            showMessage('error', error instanceof Error ? error.message : 'Retry failed');
        }
    }, [onRetryProcessing, showMessage]);

    return (
        <div className={cn("space-y-6", className)}>
            {/* Header with navigation */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <BookOpen className="size-6" />
                                Lecture Notes Management
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Upload, organize, and associate lecture materials with rubrics
                            </p>
                        </div>

                        {/* View mode navigation */}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={activeView === 'upload' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveView('upload')}
                                className="flex items-center gap-2"
                            >
                                <Upload className="size-4" />
                                <span className="hidden sm:inline">Upload</span>
                            </Button>

                            <Button
                                variant={activeView === 'list' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveView('list')}
                                className="flex items-center gap-2"
                            >
                                <List className="size-4" />
                                <span className="hidden sm:inline">List</span>
                            </Button>

                            <Button
                                variant={activeView === 'associate' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveView('associate')}
                                className="flex items-center gap-2"
                            >
                                <Link className="size-4" />
                                <span className="hidden sm:inline">Associate</span>
                            </Button>

                            <Button
                                variant={activeView === 'search' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveView('search')}
                                className="flex items-center gap-2"
                            >
                                <Search className="size-4" />
                                <span className="hidden sm:inline">Search</span>
                            </Button>
                        </div>
                    </div>

                    {/* Stats summary */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="text-center sm:text-left">
                                <div className="text-2xl font-bold text-blue-600">{notes.length}</div>
                                <div className="text-xs text-gray-600">Total Notes</div>
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="text-2xl font-bold text-green-600">
                                    {notes.filter(n => n.metadata.processingStatus === 'completed').length}
                                </div>
                                <div className="text-xs text-gray-600">Processed</div>
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="text-2xl font-bold text-yellow-600">
                                    {notes.filter(n => n.metadata.processingStatus === 'processing').length}
                                </div>
                                <div className="text-xs text-gray-600">Processing</div>
                            </div>
                            <div className="text-center sm:text-left">
                                <div className="text-2xl font-bold text-purple-600">{rubrics.length}</div>
                                <div className="text-xs text-gray-600">Rubrics</div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Global error/success messages */}
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-red-800">
                            <AlertCircle className="size-5" />
                            <span className="font-medium">{error}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {success && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-green-800">
                            <BookOpen className="size-5" />
                            <span className="font-medium">{success}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Main content area with responsive layout */}
            <div className="min-h-[400px]">
                {activeView === 'upload' && (
                    <div className="space-y-6">
                        <LectureNotesUpload
                            onFileUpload={handleUpload}
                            onBatchUpload={handleBatchUpload}
                            uploadedNotes={notes}
                            availableRubrics={rubrics}
                            maxFileSize={50}
                            acceptedFormats={['.pdf', '.docx', '.txt', '.md']}
                            disabled={loading}
                            onError={(error) => showMessage('error', error)}
                            onSuccess={(message) => showMessage('success', message)}
                            enableBatchAssociation={true}
                        />
                    </div>
                )}

                {activeView === 'list' && (
                    <div className="space-y-6">
                        <LectureNotesList
                            notes={notes}
                            rubrics={rubrics}
                            onView={handleViewNote}
                            onDelete={handleDelete}
                            onAssociate={handleAssociateFromList}
                            loading={loading}
                            emptyMessage="No lecture notes uploaded yet. Upload some materials to get started."
                        />
                    </div>
                )}

                {activeView === 'associate' && (
                    <div className="space-y-6">
                        <LectureNotesAssociation
                            notes={notes}
                            rubrics={rubrics}
                            onAssociate={handleAssociate}
                            onDisassociate={handleDisassociate}
                            loading={loading}
                        />
                    </div>
                )}

                {activeView === 'search' && (
                    <div className="space-y-6">
                        <LectureNotesSearch
                            notes={notes}
                            rubrics={rubrics}
                            onFilteredNotesChange={setFilteredNotes}
                        />

                        {/* Show filtered results */}
                        <LectureNotesList
                            notes={filteredNotes}
                            rubrics={rubrics}
                            onView={handleViewNote}
                            onDelete={handleDelete}
                            onAssociate={handleAssociateFromList}
                            loading={loading}
                        />
                    </div>
                )}
            </div>

            {/* Loading overlay */}
            {loading && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <span className="text-lg font-medium">Processing...</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Preview Modal */}
            {showPreview && selectedNote && (
                <LectureNotesPreview
                    note={selectedNote}
                    onClose={() => {
                        setShowPreview(false);
                        setSelectedNote(null);
                    }}
                    onRetry={onRetryProcessing ? handleRetryProcessing : undefined}
                />
            )}
        </div>
    );
}
