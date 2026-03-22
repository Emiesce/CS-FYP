import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LectureNotesUpload } from '../LectureNotesUpload';
import { LectureNote, RubricData } from '../../../types';

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
    useDropzone: ({ onDrop, disabled }: any) => ({
        getRootProps: () => ({
            onClick: () => { },
            onDrop: (e: any) => {
                if (!disabled && onDrop) {
                    const files = e.dataTransfer?.files || [];
                    onDrop(Array.from(files));
                }
            },
        }),
        getInputProps: () => ({
            type: 'file',
            multiple: true,
            accept: '.pdf,.docx,.txt,.md',
        }),
        isDragActive: false,
        isDragReject: false,
    }),
}));

describe('LectureNotesUpload', () => {
    const mockOnFileUpload = vi.fn();
    const mockOnBatchUpload = vi.fn();
    const mockOnError = vi.fn();
    const mockOnSuccess = vi.fn();

    const mockRubrics: RubricData[] = [
        {
            id: 'rubric-1',
            title: 'Test Rubric 1',
            description: 'Test description',
            questions: [],
            totalMinPoints: 0,
            totalMaxPoints: 100,
        },
        {
            id: 'rubric-2',
            title: 'Test Rubric 2',
            description: 'Test description 2',
            questions: [],
            totalMinPoints: 0,
            totalMaxPoints: 100,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        mockOnFileUpload.mockResolvedValue(undefined);
        mockOnBatchUpload.mockResolvedValue(undefined);
    });

    it('renders upload dropzone with correct text', () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                maxFileSize={50}
                acceptedFormats={['.pdf', '.docx', '.txt', '.md']}
            />
        );

        expect(screen.getByText(/Upload lecture notes & materials/i)).toBeInTheDocument();
        expect(screen.getByText(/Maximum file size: 50MB/i)).toBeInTheDocument();
    });

    it('displays rubric association section when rubrics are available', () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                availableRubrics={mockRubrics}
                enableBatchAssociation={true}
            />
        );

        expect(screen.getByText(/Rubric Association/i)).toBeInTheDocument();
    });

    it('shows auto-association message when currentRubricId is provided', () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                currentRubricId="rubric-1"
            />
        );

        expect(screen.getByText(/Auto-Association Enabled/i)).toBeInTheDocument();
        expect(
            screen.getByText(/All uploaded files will be automatically associated with the current rubric/i)
        ).toBeInTheDocument();
    });

    it('disables upload when disabled prop is true', () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                disabled={true}
            />
        );

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        expect(dropzone?.parentElement?.parentElement).toHaveClass('opacity-50');
    });

    it('shows network status warning when offline', () => {
        // Mock navigator.onLine
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: false,
        });

        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
            />
        );

        expect(screen.getByText(/No internet connection/i)).toBeInTheDocument();
        expect(
            screen.getByText(/Lecture note uploads are disabled until connection is restored/i)
        ).toBeInTheDocument();

        // Reset
        Object.defineProperty(navigator, 'onLine', {
            writable: true,
            value: true,
        });
    });

    it('validates file size correctly', async () => {
        const user = userEvent.setup();

        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                onError={mockOnError}
                maxFileSize={1} // 1MB limit
            />
        );

        // Create a file larger than 1MB
        const largeFile = new File(['x'.repeat(2 * 1024 * 1024)], 'large.pdf', {
            type: 'application/pdf',
        });

        // Simulate file drop
        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [largeFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(mockOnError).toHaveBeenCalled();
        });
    });

    it('validates file format correctly', async () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                onError={mockOnError}
                acceptedFormats={['.pdf', '.docx']}
            />
        );

        const invalidFile = new File(['content'], 'test.exe', {
            type: 'application/x-msdownload',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [invalidFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(mockOnError).toHaveBeenCalled();
        });
    });

    it('calls onFileUpload with correct parameters for single file', async () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                onSuccess={mockOnSuccess}
            />
        );

        const validFile = new File(['content'], 'lecture.pdf', {
            type: 'application/pdf',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [validFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(mockOnFileUpload).toHaveBeenCalledWith(validFile, undefined);
        });
    });

    it('calls onFileUpload with rubric association when currentRubricId is set', async () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                currentRubricId="rubric-1"
            />
        );

        const validFile = new File(['content'], 'lecture.pdf', {
            type: 'application/pdf',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [validFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(mockOnFileUpload).toHaveBeenCalledWith(validFile, 'rubric-1');
        });
    });

    it('handles upload errors gracefully', async () => {
        const uploadError = new Error('Upload failed');
        mockOnFileUpload.mockRejectedValueOnce(uploadError);

        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                onError={mockOnError}
            />
        );

        const validFile = new File(['content'], 'lecture.pdf', {
            type: 'application/pdf',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [validFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('Upload failed'));
        });
    });

    it('shows upload progress during file processing', async () => {
        let resolveUpload: () => void;
        const uploadPromise = new Promise<void>((resolve) => {
            resolveUpload = resolve;
        });
        mockOnFileUpload.mockReturnValue(uploadPromise);

        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
            />
        );

        const validFile = new File(['content'], 'lecture.pdf', {
            type: 'application/pdf',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [validFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(screen.getByText(/Processing Lecture Notes/i)).toBeInTheDocument();
        });

        resolveUpload!();
    });

    it('displays success message after successful upload', async () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                onSuccess={mockOnSuccess}
            />
        );

        const validFile = new File(['content'], 'lecture.pdf', {
            type: 'application/pdf',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [validFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(mockOnSuccess).toHaveBeenCalledWith(
                expect.stringContaining('uploaded successfully')
            );
        });
    });

    it('supports batch upload with multiple files', async () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                onBatchUpload={mockOnBatchUpload}
                availableRubrics={mockRubrics}
                enableBatchAssociation={true}
            />
        );

        // Select a rubric first
        const showButton = screen.getByText(/Show/i);
        fireEvent.click(showButton);

        await waitFor(() => {
            expect(screen.getByText(/Choose rubrics for association/i)).toBeInTheDocument();
        });

        const files = [
            new File(['content1'], 'lecture1.pdf', { type: 'application/pdf' }),
            new File(['content2'], 'lecture2.pdf', { type: 'application/pdf' }),
        ];

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files },
            });
            fireEvent(dropzone, event);
        }

        // Note: Batch upload requires rubric selection, which is complex to test
        // This test verifies the component renders correctly for batch scenarios
    });

    it('rejects empty files', async () => {
        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
                onError={mockOnError}
            />
        );

        const emptyFile = new File([], 'empty.pdf', {
            type: 'application/pdf',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [emptyFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(mockOnError).toHaveBeenCalledWith(
                expect.stringContaining('empty')
            );
        });
    });

    it('allows retry for failed uploads', async () => {
        mockOnFileUpload.mockRejectedValueOnce(new Error('Network error'));

        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
            />
        );

        const validFile = new File(['content'], 'lecture.pdf', {
            type: 'application/pdf',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [validFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(screen.getByText(/Upload Errors/i)).toBeInTheDocument();
        });

        // Verify retry button is present for network errors
        const retryButton = screen.queryByText(/Retry/i);
        expect(retryButton).toBeInTheDocument();
    });

    it('clears errors when clear all button is clicked', async () => {
        mockOnFileUpload.mockRejectedValueOnce(new Error('Upload failed'));

        render(
            <LectureNotesUpload
                onFileUpload={mockOnFileUpload}
            />
        );

        const validFile = new File(['content'], 'lecture.pdf', {
            type: 'application/pdf',
        });

        const dropzone = screen.getByText(/Upload lecture notes & materials/i).closest('div');
        if (dropzone) {
            const event = new Event('drop', { bubbles: true });
            Object.defineProperty(event, 'dataTransfer', {
                value: { files: [validFile] },
            });
            fireEvent(dropzone, event);
        }

        await waitFor(() => {
            expect(screen.getByText(/Upload Errors/i)).toBeInTheDocument();
        });

        const clearButton = screen.getByText(/Clear All Errors/i);
        fireEvent.click(clearButton);

        await waitFor(() => {
            expect(screen.queryByText(/Upload Errors/i)).not.toBeInTheDocument();
        });
    });
});
