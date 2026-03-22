import React, { useState, useCallback } from 'react';
import { Link, Unlink, Check, X, Search, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { LectureNote, RubricData } from '../../types';

interface LectureNotesAssociationProps {
    notes: LectureNote[];
    rubrics: RubricData[];
    onAssociate: (noteIds: string[], rubricIds: string[]) => Promise<void>;
    onDisassociate: (noteIds: string[], rubricIds: string[]) => Promise<void>;
    loading?: boolean;
    className?: string;
}

export function LectureNotesAssociation({
    notes,
    rubrics,
    onAssociate,
    onDisassociate,
    loading = false,
    className
}: LectureNotesAssociationProps) {
    const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
    const [selectedRubrics, setSelectedRubrics] = useState<Set<string>>(new Set());
    const [noteSearchTerm, setNoteSearchTerm] = useState('');
    const [rubricSearchTerm, setRubricSearchTerm] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);

    // Filter notes and rubrics based on search
    const filteredNotes = notes.filter(note =>
        note.originalName.toLowerCase().includes(noteSearchTerm.toLowerCase()) ||
        note.fileType.toLowerCase().includes(noteSearchTerm.toLowerCase())
    );

    const filteredRubrics = rubrics.filter(rubric =>
        rubric.title.toLowerCase().includes(rubricSearchTerm.toLowerCase()) ||
        rubric.description.toLowerCase().includes(rubricSearchTerm.toLowerCase())
    );

    // Toggle selection
    const toggleNoteSelection = (noteId: string) => {
        const newSelection = new Set(selectedNotes);
        if (newSelection.has(noteId)) {
            newSelection.delete(noteId);
        } else {
            newSelection.add(noteId);
        }
        setSelectedNotes(newSelection);
    };

    const toggleRubricSelection = (rubricId: string) => {
        const newSelection = new Set(selectedRubrics);
        if (newSelection.has(rubricId)) {
            newSelection.delete(rubricId);
        } else {
            newSelection.add(rubricId);
        }
        setSelectedRubrics(newSelection);
    };

    // Select all
    const selectAllNotes = () => {
        setSelectedNotes(new Set(filteredNotes.map(n => n.id)));
    };

    const selectAllRubrics = () => {
        setSelectedRubrics(new Set(filteredRubrics.map(r => r.id)));
    };

    // Clear selections
    const clearNoteSelection = () => setSelectedNotes(new Set());
    const clearRubricSelection = () => setSelectedRubrics(new Set());
    const clearAllSelections = () => {
        clearNoteSelection();
        clearRubricSelection();
    };

    // Handle bulk association
    const handleBulkAssociate = async () => {
        if (selectedNotes.size === 0 || selectedRubrics.size === 0) {
            return;
        }

        setIsProcessing(true);
        try {
            await onAssociate(Array.from(selectedNotes), Array.from(selectedRubrics));
            clearAllSelections();
        } finally {
            setIsProcessing(false);
        }
    };

    // Handle bulk disassociation
    const handleBulkDisassociate = async () => {
        if (selectedNotes.size === 0 || selectedRubrics.size === 0) {
            return;
        }

        setIsProcessing(true);
        try {
            await onDisassociate(Array.from(selectedNotes), Array.from(selectedRubrics));
            clearAllSelections();
        } finally {
            setIsProcessing(false);
        }
    };

    // Drag and drop handlers
    const handleDragStart = (noteId: string) => {
        setDraggedNoteId(noteId);
    };

    const handleDragEnd = () => {
        setDraggedNoteId(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent, rubricId: string) => {
        e.preventDefault();
        if (!draggedNoteId) return;

        setIsProcessing(true);
        try {
            await onAssociate([draggedNoteId], [rubricId]);
        } finally {
            setIsProcessing(false);
            setDraggedNoteId(null);
        }
    };

    // Check if note is associated with rubric
    const isAssociated = (noteId: string, rubricId: string): boolean => {
        const note = notes.find(n => n.id === noteId);
        return note?.associatedRubrics.includes(rubricId) || false;
    };

    // Get association count
    const getAssociationCount = (noteId: string): number => {
        const note = notes.find(n => n.id === noteId);
        return note?.associatedRubrics.length || 0;
    };

    return (
        <div className={cn("space-y-6", className)}>
            {/* Header with bulk actions */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Association Management
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                                Select notes and rubrics to create or remove associations
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearAllSelections}
                                disabled={selectedNotes.size === 0 && selectedRubrics.size === 0}
                            >
                                <X className="size-4 mr-1" />
                                Clear All
                            </Button>
                        </div>
                    </div>

                    {/* Selection summary and actions */}
                    {(selectedNotes.size > 0 || selectedRubrics.size > 0) && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="font-medium text-blue-900">
                                        {selectedNotes.size} note{selectedNotes.size !== 1 ? 's' : ''} selected
                                    </span>
                                    <ArrowRight className="size-4 text-blue-600" />
                                    <span className="font-medium text-blue-900">
                                        {selectedRubrics.size} rubric{selectedRubrics.size !== 1 ? 's' : ''} selected
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        onClick={handleBulkAssociate}
                                        disabled={selectedNotes.size === 0 || selectedRubrics.size === 0 || isProcessing}
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="size-4 mr-1 animate-spin" />
                                        ) : (
                                            <Link className="size-4 mr-1" />
                                        )}
                                        Associate
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleBulkDisassociate}
                                        disabled={selectedNotes.size === 0 || selectedRubrics.size === 0 || isProcessing}
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="size-4 mr-1 animate-spin" />
                                        ) : (
                                            <Unlink className="size-4 mr-1" />
                                        )}
                                        Disassociate
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lecture Notes Column */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-gray-900">Lecture Notes</h4>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={selectAllNotes}
                                    disabled={filteredNotes.length === 0}
                                >
                                    Select All
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearNoteSelection}
                                    disabled={selectedNotes.size === 0}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search notes..."
                                value={noteSearchTerm}
                                onChange={(e) => setNoteSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Notes list */}
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {filteredNotes.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    {noteSearchTerm ? 'No notes match your search' : 'No lecture notes available'}
                                </div>
                            ) : (
                                filteredNotes.map(note => (
                                    <div
                                        key={note.id}
                                        draggable
                                        onDragStart={() => handleDragStart(note.id)}
                                        onDragEnd={handleDragEnd}
                                        onClick={() => toggleNoteSelection(note.id)}
                                        className={cn(
                                            "p-3 border rounded-lg cursor-pointer transition-all",
                                            selectedNotes.has(note.id)
                                                ? "bg-blue-50 border-blue-300"
                                                : "bg-white border-gray-200 hover:border-gray-300",
                                            draggedNoteId === note.id && "opacity-50"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "flex-shrink-0 w-5 h-5 border rounded mt-0.5 flex items-center justify-center",
                                                selectedNotes.has(note.id)
                                                    ? "bg-blue-600 border-blue-600"
                                                    : "border-gray-300"
                                            )}>
                                                {selectedNotes.has(note.id) && (
                                                    <Check className="size-3 text-white" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">
                                                    {note.originalName}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {note.fileType.toUpperCase()} • {getAssociationCount(note.id)} association{getAssociationCount(note.id) !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Rubrics Column */}
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-semibold text-gray-900">Rubrics</h4>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={selectAllRubrics}
                                    disabled={filteredRubrics.length === 0}
                                >
                                    Select All
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearRubricSelection}
                                    disabled={selectedRubrics.size === 0}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search rubrics..."
                                value={rubricSearchTerm}
                                onChange={(e) => setRubricSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Rubrics list */}
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {filteredRubrics.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm">
                                    {rubricSearchTerm ? 'No rubrics match your search' : 'No rubrics available'}
                                </div>
                            ) : (
                                filteredRubrics.map(rubric => (
                                    <div
                                        key={rubric.id}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, rubric.id)}
                                        onClick={() => toggleRubricSelection(rubric.id)}
                                        className={cn(
                                            "p-3 border rounded-lg cursor-pointer transition-all",
                                            selectedRubrics.has(rubric.id)
                                                ? "bg-blue-50 border-blue-300"
                                                : "bg-white border-gray-200 hover:border-gray-300",
                                            draggedNoteId && "ring-2 ring-blue-200"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn(
                                                "flex-shrink-0 w-5 h-5 border rounded mt-0.5 flex items-center justify-center",
                                                selectedRubrics.has(rubric.id)
                                                    ? "bg-blue-600 border-blue-600"
                                                    : "border-gray-300"
                                            )}>
                                                {selectedRubrics.has(rubric.id) && (
                                                    <Check className="size-3 text-white" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">
                                                    {rubric.title}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {rubric.questions.length} question{rubric.questions.length !== 1 ? 's' : ''} • {rubric.totalMinPoints}-{rubric.totalMaxPoints} points
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Instructions */}
            <Card className="bg-gray-50">
                <CardContent className="p-4">
                    <div className="text-sm text-gray-600 space-y-2">
                        <p className="font-medium text-gray-900">How to use:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Click to select notes and rubrics, then use the Associate/Disassociate buttons</li>
                            <li>Drag a note and drop it on a rubric for quick association</li>
                            <li>Use "Select All" to quickly select all items in a column</li>
                            <li>Search to filter notes or rubrics by name</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
