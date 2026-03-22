import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LectureNotesAssociation } from '../LectureNotesAssociation';
import { LectureNote, RubricData } from '../../../types';

describe('LectureNotesAssociation', () => {
    const mockOnAssociate = vi.fn();
    const mockOnDisassociate = vi.fn();

    const mockNotes: LectureNote[] = [
        {
            id: 'note-1',
            filename: 'lecture1.pdf',
            originalName: 'Lecture 1 - Introduction.pdf',
            fileSize: 1024000,
            fileType: 'pdf',
            uploadedAt: new Date('2024-01-01'),
            associatedRubrics: ['rubric-1'],
            metadata: {
                processingStatus: 'completed',
            },
        },
        {
            id: 'note-2',
            filename: 'lecture2.docx',
            originalName: 'Lecture 2 - Advanced Topics.docx',
            fileSize: 512000,
            fileType: 'docx',
            uploadedAt: new Date('2024-01-02'),
            associatedRubrics: [],
            metadata: {
                processingStatus: 'completed',
            },
        },
        {
            id: 'note-3',
            filename: 'notes.txt',
            originalName: 'Class Notes.txt',
            fileSize: 256000,
            fileType: 'txt',
            uploadedAt: new Date('2024-01-03'),
            associatedRubrics: ['rubric-1', 'rubric-2'],
            metadata: {
                processingStatus: 'completed',
            },
        },
    ];

    const mockRubrics: RubricData[] = [
        {
            id: 'rubric-1',
            title: 'Assignment 1',
            description: 'First assignment',
            questions: [{ id: 'q1', text: 'Question 1', minPoints: 0, maxPoints: 10 }],
            totalMinPoints: 0,
            totalMaxPoints: 10,
        },
        {
            id: 'rubric-2',
            title: 'Assignment 2',
            description: 'Second assignment',
            questions: [{ id: 'q2', text: 'Question 2', minPoints: 0, maxPoints: 20 }],
            totalMinPoints: 0,
            totalMaxPoints: 20,
        },
        {
            id: 'rubric-3',
            title: 'Final Exam',
            description: 'Final examination',
            questions: [{ id: 'q3', text: 'Question 3', minPoints: 0, maxPoints: 100 }],
            totalMinPoints: 0,
            totalMaxPoints: 100,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnAssociate.mockResolvedValue(undefined);
        mockOnDisassociate.mockResolvedValue(undefined);
    });

    it('renders association management interface', () => {
        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        expect(screen.getByText(/Association Management/i)).toBeInTheDocument();
        expect(screen.getByText(/Lecture Notes/i)).toBeInTheDocument();
        expect(screen.getByText(/Rubrics/i)).toBeInTheDocument();
    });

    it('displays all notes and rubrics', () => {
        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        // Check notes
        expect(screen.getByText(/Lecture 1 - Introduction\.pdf/i)).toBeInTheDocument();
        expect(screen.getByText(/Lecture 2 - Advanced Topics\.docx/i)).toBeInTheDocument();
        expect(screen.getByText(/Class Notes\.txt/i)).toBeInTheDocument();

        // Check rubrics
        expect(screen.getByText(/Assignment 1/i)).toBeInTheDocument();
        expect(screen.getByText(/Assignment 2/i)).toBeInTheDocument();
        expect(screen.getByText(/Final Exam/i)).toBeInTheDocument();
    });

    it('allows selecting notes', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        const note = screen.getByText(/Lecture 1 - Introduction\.pdf/i);
        await user.click(note);

        // Check if selection is reflected in UI
        expect(screen.getByText(/1 note selected/i)).toBeInTheDocument();
    });

    it('allows selecting rubrics', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        const rubric = screen.getByText(/Assignment 1/i);
        await user.click(rubric);

        expect(screen.getByText(/1 rubric selected/i)).toBeInTheDocument();
    });

    it('allows selecting multiple notes and rubrics', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        // Select multiple notes
        await user.click(screen.getByText(/Lecture 1 - Introduction\.pdf/i));
        await user.click(screen.getByText(/Lecture 2 - Advanced Topics\.docx/i));

        // Select multiple rubrics
        await user.click(screen.getByText(/Assignment 1/i));
        await user.click(screen.getByText(/Assignment 2/i));

        expect(screen.getByText(/2 notes selected/i)).toBeInTheDocument();
        expect(screen.getByText(/2 rubrics selected/i)).toBeInTheDocument();
    });

    it('calls onAssociate when associate button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        // Select a note and rubric
        await user.click(screen.getByText(/Lecture 1 - Introduction\.pdf/i));
        await user.click(screen.getByText(/Assignment 1/i));

        // Click associate button
        const associateButton = screen.getByRole('button', { name: /Associate/i });
        await user.click(associateButton);

        await waitFor(() => {
            expect(mockOnAssociate).toHaveBeenCalledWith(['note-1'], ['rubric-1']);
        });
    });

    it('calls onDisassociate when disassociate button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        // Select a note and rubric
        await user.click(screen.getByText(/Lecture 1 - Introduction\.pdf/i));
        await user.click(screen.getByText(/Assignment 1/i));

        // Click disassociate button
        const disassociateButton = screen.getByRole('button', { name: /Disassociate/i });
        await user.click(disassociateButton);

        await waitFor(() => {
            expect(mockOnDisassociate).toHaveBeenCalledWith(['note-1'], ['rubric-1']);
        });
    });

    it('clears selections after successful association', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        // Select and associate
        await user.click(screen.getByText(/Lecture 1 - Introduction\.pdf/i));
        await user.click(screen.getByText(/Assignment 1/i));

        const associateButton = screen.getByRole('button', { name: /Associate/i });
        await user.click(associateButton);

        await waitFor(() => {
            expect(screen.queryByText(/1 note selected/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/1 rubric selected/i)).not.toBeInTheDocument();
        });
    });

    it('supports select all functionality for notes', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        const selectAllButtons = screen.getAllByText(/Select All/i);
        await user.click(selectAllButtons[0]); // First one is for notes

        expect(screen.getByText(/3 notes selected/i)).toBeInTheDocument();
    });

    it('supports select all functionality for rubrics', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        const selectAllButtons = screen.getAllByText(/Select All/i);
        await user.click(selectAllButtons[1]); // Second one is for rubrics

        expect(screen.getByText(/3 rubrics selected/i)).toBeInTheDocument();
    });

    it('supports clear selection functionality', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        // Select items
        await user.click(screen.getByText(/Lecture 1 - Introduction\.pdf/i));
        await user.click(screen.getByText(/Assignment 1/i));

        expect(screen.getByText(/1 note selected/i)).toBeInTheDocument();

        // Clear all
        const clearAllButton = screen.getByRole('button', { name: /Clear All/i });
        await user.click(clearAllButton);

        await waitFor(() => {
            expect(screen.queryByText(/1 note selected/i)).not.toBeInTheDocument();
        });
    });

    it('filters notes based on search query', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        const noteSearchInput = screen.getAllByPlaceholderText(/Search/i)[0];
        await user.type(noteSearchInput, 'Introduction');

        // Should show only matching note
        expect(screen.getByText(/Lecture 1 - Introduction\.pdf/i)).toBeInTheDocument();
        expect(screen.queryByText(/Lecture 2 - Advanced Topics\.docx/i)).not.toBeInTheDocument();
    });

    it('filters rubrics based on search query', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        const rubricSearchInput = screen.getAllByPlaceholderText(/Search/i)[1];
        await user.type(rubricSearchInput, 'Final');

        // Should show only matching rubric
        expect(screen.getByText(/Final Exam/i)).toBeInTheDocument();
        expect(screen.queryByText(/Assignment 1/i)).not.toBeInTheDocument();
    });

    it('shows empty state when no notes are available', () => {
        render(
            <LectureNotesAssociation
                notes={[]}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        expect(screen.getByText(/No lecture notes available/i)).toBeInTheDocument();
    });

    it('shows empty state when no rubrics are available', () => {
        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={[]}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        expect(screen.getByText(/No rubrics available/i)).toBeInTheDocument();
    });

    it('disables associate button when no selections are made', () => {
        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        const associateButton = screen.queryByRole('button', { name: /Associate/i });
        expect(associateButton).toBeDisabled();
    });

    it('displays association count for each note', () => {
        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        // note-1 has 1 association
        expect(screen.getByText(/1 association$/i)).toBeInTheDocument();

        // note-3 has 2 associations
        expect(screen.getByText(/2 associations/i)).toBeInTheDocument();
    });

    it('shows loading state during association', async () => {
        const user = userEvent.setup();
        let resolveAssociate: () => void;
        const associatePromise = new Promise<void>((resolve) => {
            resolveAssociate = resolve;
        });
        mockOnAssociate.mockReturnValue(associatePromise);

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        await user.click(screen.getByText(/Lecture 1 - Introduction\.pdf/i));
        await user.click(screen.getByText(/Assignment 1/i));

        const associateButton = screen.getByRole('button', { name: /Associate/i });
        await user.click(associateButton);

        // Should show loading state
        await waitFor(() => {
            expect(associateButton).toBeDisabled();
        });

        resolveAssociate!();
    });

    it('displays instructions for using the interface', () => {
        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        expect(screen.getByText(/How to use:/i)).toBeInTheDocument();
        expect(screen.getByText(/Click to select notes and rubrics/i)).toBeInTheDocument();
        expect(screen.getByText(/Drag a note and drop it on a rubric/i)).toBeInTheDocument();
    });

    it('supports drag and drop for quick association', async () => {
        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        const note = screen.getByText(/Lecture 1 - Introduction\.pdf/i);
        const rubric = screen.getByText(/Assignment 2/i);

        // Simulate drag start
        fireEvent.dragStart(note.closest('div')!);

        // Simulate drop
        fireEvent.dragOver(rubric.closest('div')!);
        fireEvent.drop(rubric.closest('div')!);

        await waitFor(() => {
            expect(mockOnAssociate).toHaveBeenCalledWith(['note-1'], ['rubric-2']);
        });
    });

    it('handles bulk operations with multiple selections', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesAssociation
                notes={mockNotes}
                rubrics={mockRubrics}
                onAssociate={mockOnAssociate}
                onDisassociate={mockOnDisassociate}
            />
        );

        // Select multiple notes
        await user.click(screen.getByText(/Lecture 1 - Introduction\.pdf/i));
        await user.click(screen.getByText(/Lecture 2 - Advanced Topics\.docx/i));

        // Select multiple rubrics
        await user.click(screen.getByText(/Assignment 1/i));
        await user.click(screen.getByText(/Assignment 2/i));

        const associateButton = screen.getByRole('button', { name: /Associate/i });
        await user.click(associateButton);

        await waitFor(() => {
            expect(mockOnAssociate).toHaveBeenCalledWith(
                expect.arrayContaining(['note-1', 'note-2']),
                expect.arrayContaining(['rubric-1', 'rubric-2'])
            );
        });
    });
});
