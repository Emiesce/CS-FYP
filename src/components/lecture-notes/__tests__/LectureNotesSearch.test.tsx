import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LectureNotesSearch } from '../LectureNotesSearch';
import { LectureNote, RubricData } from '../../../types';

describe('LectureNotesSearch', () => {
    const mockOnFilteredNotesChange = vi.fn();

    const mockNotes: LectureNote[] = [
        {
            id: 'note-1',
            filename: 'lecture1.pdf',
            originalName: 'Introduction to Computer Science.pdf',
            fileSize: 1024000,
            fileType: 'pdf',
            uploadedAt: new Date('2024-01-15'),
            extractedContent: 'This lecture covers basic programming concepts and algorithms.',
            associatedRubrics: ['rubric-1'],
            metadata: {
                processingStatus: 'completed',
            },
        },
        {
            id: 'note-2',
            filename: 'lecture2.docx',
            originalName: 'Advanced Data Structures.docx',
            fileSize: 512000,
            fileType: 'docx',
            uploadedAt: new Date('2024-02-10'),
            extractedContent: 'Deep dive into trees, graphs, and hash tables.',
            associatedRubrics: ['rubric-1', 'rubric-2'],
            metadata: {
                processingStatus: 'completed',
            },
        },
        {
            id: 'note-3',
            filename: 'notes.txt',
            originalName: 'Machine Learning Basics.txt',
            fileSize: 256000,
            fileType: 'txt',
            uploadedAt: new Date('2024-03-05'),
            extractedContent: 'Introduction to neural networks and supervised learning.',
            associatedRubrics: [],
            metadata: {
                processingStatus: 'processing',
            },
        },
        {
            id: 'note-4',
            filename: 'chapter.md',
            originalName: 'Database Systems.md',
            fileSize: 128000,
            fileType: 'md',
            uploadedAt: new Date('2024-01-20'),
            extractedContent: 'SQL queries and database normalization.',
            associatedRubrics: ['rubric-2'],
            metadata: {
                processingStatus: 'failed',
            },
        },
    ];

    const mockRubrics: RubricData[] = [
        {
            id: 'rubric-1',
            title: 'Programming Assignment',
            description: 'Basic programming tasks',
            questions: [],
            totalMinPoints: 0,
            totalMaxPoints: 100,
        },
        {
            id: 'rubric-2',
            title: 'Data Structures Quiz',
            description: 'Quiz on data structures',
            questions: [],
            totalMinPoints: 0,
            totalMaxPoints: 50,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders search interface', () => {
        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        expect(
            screen.getByPlaceholderText(/Search lecture notes by filename or content/i)
        ).toBeInTheDocument();
        expect(screen.getByText(/Filters/i)).toBeInTheDocument();
    });

    it('displays total note count', () => {
        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        expect(screen.getByText(/Showing 4 of 4 lecture notes/i)).toBeInTheDocument();
    });

    it('filters notes by search query in filename', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Search lecture notes/i);
        await user.type(searchInput, 'Computer Science');

        await waitFor(() => {
            expect(mockOnFilteredNotesChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'note-1' }),
                ])
            );
        });
    });

    it('filters notes by search query in content', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Search lecture notes/i);
        await user.type(searchInput, 'neural networks');

        await waitFor(() => {
            expect(mockOnFilteredNotesChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'note-3' }),
                ])
            );
        });
    });

    it('clears search query when X button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Search lecture notes/i);
        await user.type(searchInput, 'test query');

        const clearButton = screen.getByRole('button', { name: '' });
        await user.click(clearButton);

        expect(searchInput).toHaveValue('');
    });

    it('shows filter panel when Filters button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        const filtersButton = screen.getByRole('button', { name: /Filters/i });
        await user.click(filtersButton);

        expect(screen.getByText(/File Type/i)).toBeInTheDocument();
        expect(screen.getByText(/Processing Status/i)).toBeInTheDocument();
    });

    it('filters notes by file type', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        // Open filters
        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // Select PDF file type
        const pdfButton = screen.getByRole('button', { name: /PDF/i });
        await user.click(pdfButton);

        await waitFor(() => {
            expect(mockOnFilteredNotesChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ fileType: 'pdf' }),
                ])
            );
        });
    });

    it('filters notes by multiple file types', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // Select PDF and DOCX
        await user.click(screen.getByRole('button', { name: /PDF/i }));
        await user.click(screen.getByRole('button', { name: /DOCX/i }));

        await waitFor(() => {
            const lastCall = mockOnFilteredNotesChange.mock.calls[mockOnFilteredNotesChange.mock.calls.length - 1];
            expect(lastCall[0]).toHaveLength(2);
        });
    });

    it('filters notes by rubric association', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // Select a rubric
        const rubricButton = screen.getByRole('button', { name: /Programming Assignment/i });
        await user.click(rubricButton);

        await waitFor(() => {
            expect(mockOnFilteredNotesChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'note-1' }),
                    expect.objectContaining({ id: 'note-2' }),
                ])
            );
        });
    });

    it('filters notes by processing status', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // Select completed status
        const completedButton = screen.getByRole('button', { name: /completed/i });
        await user.click(completedButton);

        await waitFor(() => {
            const lastCall = mockOnFilteredNotesChange.mock.calls[mockOnFilteredNotesChange.mock.calls.length - 1];
            expect(lastCall[0]).toHaveLength(2); // note-1 and note-2 are completed
        });
    });

    it('filters notes by date range', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // Set date range
        const fromInput = screen.getByLabelText(/From/i);
        const toInput = screen.getByLabelText(/To/i);

        await user.type(fromInput, '2024-02-01');
        await user.type(toInput, '2024-03-31');

        await waitFor(() => {
            const lastCall = mockOnFilteredNotesChange.mock.calls[mockOnFilteredNotesChange.mock.calls.length - 1];
            expect(lastCall[0]).toHaveLength(2); // note-2 and note-3 are in range
        });
    });

    it('combines multiple filters', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // Apply multiple filters
        await user.click(screen.getByRole('button', { name: /DOCX/i }));
        await user.click(screen.getByRole('button', { name: /completed/i }));

        await waitFor(() => {
            expect(mockOnFilteredNotesChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'note-2' }),
                ])
            );
        });
    });

    it('displays active filter count', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // Apply filters
        await user.click(screen.getByRole('button', { name: /PDF/i }));
        await user.click(screen.getByRole('button', { name: /completed/i }));

        // Should show 2 filters active
        await waitFor(() => {
            expect(screen.getByText('2')).toBeInTheDocument();
        });
    });

    it('clears all filters when Clear button is clicked', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        // Apply some filters
        const searchInput = screen.getByPlaceholderText(/Search lecture notes/i);
        await user.type(searchInput, 'test');

        await user.click(screen.getByRole('button', { name: /Filters/i }));
        await user.click(screen.getByRole('button', { name: /PDF/i }));

        // Clear all filters
        const clearButton = screen.getByRole('button', { name: /Clear/i });
        await user.click(clearButton);

        await waitFor(() => {
            expect(searchInput).toHaveValue('');
            expect(mockOnFilteredNotesChange).toHaveBeenCalledWith(mockNotes);
        });
    });

    it('updates filtered count display', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Search lecture notes/i);
        await user.type(searchInput, 'Data');

        await waitFor(() => {
            expect(screen.getByText(/Showing 2 of 4 lecture notes/i)).toBeInTheDocument();
        });
    });

    it('shows active filters indicator', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));
        await user.click(screen.getByRole('button', { name: /PDF/i }));

        await waitFor(() => {
            expect(screen.getByText(/1 filter active/i)).toBeInTheDocument();
        });
    });

    it('handles empty search results', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Search lecture notes/i);
        await user.type(searchInput, 'nonexistent query xyz');

        await waitFor(() => {
            expect(screen.getByText(/Showing 0 of 4 lecture notes/i)).toBeInTheDocument();
        });
    });

    it('filters are case-insensitive', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Search lecture notes/i);
        await user.type(searchInput, 'COMPUTER SCIENCE');

        await waitFor(() => {
            expect(mockOnFilteredNotesChange).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'note-1' }),
                ])
            );
        });
    });

    it('handles notes without extracted content', async () => {
        const notesWithoutContent: LectureNote[] = [
            {
                ...mockNotes[0],
                extractedContent: undefined,
            },
        ];

        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={notesWithoutContent}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        const searchInput = screen.getByPlaceholderText(/Search lecture notes/i);
        await user.type(searchInput, 'test');

        // Should not crash and should filter by filename only
        await waitFor(() => {
            expect(mockOnFilteredNotesChange).toHaveBeenCalled();
        });
    });

    it('persists filter state when toggling filter panel', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        // Open filters and apply
        await user.click(screen.getByRole('button', { name: /Filters/i }));
        await user.click(screen.getByRole('button', { name: /PDF/i }));

        // Close filters
        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // Reopen filters
        await user.click(screen.getByRole('button', { name: /Filters/i }));

        // PDF filter should still be active
        const pdfButton = screen.getByRole('button', { name: /PDF/i });
        expect(pdfButton).toHaveClass('bg-blue-500');
    });

    it('filters by start date only', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        const fromInput = screen.getByLabelText(/From/i);
        await user.type(fromInput, '2024-02-01');

        await waitFor(() => {
            const lastCall = mockOnFilteredNotesChange.mock.calls[mockOnFilteredNotesChange.mock.calls.length - 1];
            expect(lastCall[0]).toHaveLength(2); // note-2 and note-3
        });
    });

    it('filters by end date only', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        const toInput = screen.getByLabelText(/To/i);
        await user.type(toInput, '2024-01-31');

        await waitFor(() => {
            const lastCall = mockOnFilteredNotesChange.mock.calls[mockOnFilteredNotesChange.mock.calls.length - 1];
            expect(lastCall[0]).toHaveLength(2); // note-1 and note-4
        });
    });

    it('shows all available file types', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        expect(screen.getByRole('button', { name: /PDF/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /DOCX/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /TXT/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /MD/i })).toBeInTheDocument();
    });

    it('shows all processing statuses', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesSearch
                notes={mockNotes}
                rubrics={mockRubrics}
                onFilteredNotesChange={mockOnFilteredNotesChange}
            />
        );

        await user.click(screen.getByRole('button', { name: /Filters/i }));

        expect(screen.getByRole('button', { name: /pending/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /processing/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /failed/i })).toBeInTheDocument();
    });
});
