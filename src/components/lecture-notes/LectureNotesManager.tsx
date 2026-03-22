import React, { useState } from 'react';
import { LectureNote, RubricData } from '../../types';
import { LectureNotesSearch } from './LectureNotesSearch';
import { LectureNotesList } from './LectureNotesList';
import { cn } from '../ui/utils';

interface LectureNotesManagerProps {
    notes: LectureNote[];
    rubrics?: RubricData[];
    onView: (note: LectureNote) => void;
    onDelete: (noteId: string) => void;
    onAssociate: (noteId: string) => void;
    loading?: boolean;
    className?: string;
}

export function LectureNotesManager({
    notes,
    rubrics = [],
    onView,
    onDelete,
    onAssociate,
    loading = false,
    className
}: LectureNotesManagerProps) {
    const [filteredNotes, setFilteredNotes] = useState<LectureNote[]>(notes);

    return (
        <div className={cn("space-y-6", className)}>
            {/* Search and Filter Section */}
            {notes.length > 0 && (
                <LectureNotesSearch
                    notes={notes}
                    rubrics={rubrics}
                    onFilteredNotesChange={setFilteredNotes}
                />
            )}

            {/* Notes List */}
            <LectureNotesList
                notes={filteredNotes}
                rubrics={rubrics}
                onView={onView}
                onDelete={onDelete}
                onAssociate={onAssociate}
                loading={loading}
            />
        </div>
    );
}
