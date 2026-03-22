import React from 'react';
import { BookOpen, FileText, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { LectureNote } from '../../types';
import { FileStorageService } from '../../utils/fileStorage';

interface LectureNotesDisplayProps {
    notes: LectureNote[];
    className?: string;
}

export function LectureNotesDisplay({ notes }: LectureNotesDisplayProps) {
    const [fileAvailability, setFileAvailability] = React.useState<Record<string, boolean>>({});

    // Check file availability on mount and when notes change
    React.useEffect(() => {
        const checkFiles = async () => {
            const availability: Record<string, boolean> = {};
            for (const note of notes) {
                // Use sync check for immediate feedback
                availability[note.id] = FileStorageService.hasFileSync(note.id);

                // Then check async (backend)
                const hasFile = await FileStorageService.hasFile(note.id);
                if (hasFile !== availability[note.id]) {
                    setFileAvailability(prev => ({ ...prev, [note.id]: hasFile }));
                }
            }
            setFileAvailability(availability);
        };

        if (notes && notes.length > 0) {
            checkFiles();
        }
    }, [notes]);

    if (!notes || notes.length === 0) {
        return (
            <Card className="border-gray-200 bg-gray-50">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-gray-500">
                        <BookOpen className="size-5" />
                        <p className="text-sm">No lecture notes associated with this rubric</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (date: Date | string): string => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(new Date(date));
    };

    const handleDownload = async (note: LectureNote) => {
        try {
            // Retrieve file download URL
            const downloadUrl = await FileStorageService.getDownloadUrl(note.id);

            if (!downloadUrl) {
                console.error('File content not found for:', note.filename);
                alert('File content not found. The file may have been deleted or not uploaded properly.');
                return;
            }

            // If it's a backend URL, open it directly
            if (downloadUrl.startsWith('http')) {
                window.open(downloadUrl, '_blank');
            } else {
                // It's a base64 data URL from localStorage
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = note.originalName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error('Error downloading file:', error);
            alert('Failed to download file. Please try again.');
        }
    };

    const handleView = async (note: LectureNote) => {
        try {
            // Retrieve file URL
            const fileUrl = await FileStorageService.getFile(note.id);

            if (!fileUrl) {
                console.error('File content not found for:', note.filename);
                alert('File content not found. The file may have been deleted or not uploaded properly.');
                return;
            }

            // If it's a backend URL, open it directly
            if (fileUrl.startsWith('http')) {
                window.open(fileUrl, '_blank');
            } else {
                // It's a base64 data URL from localStorage
                const newWindow = window.open();
                if (newWindow) {
                    if (note.fileType === 'pdf') {
                        // For PDFs, embed in an iframe
                        newWindow.document.write(`
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>${note.originalName}</title>
                                <style>
                                    body { margin: 0; padding: 0; }
                                    iframe { width: 100%; height: 100vh; border: none; }
                                </style>
                            </head>
                            <body>
                                <iframe src="${fileUrl}"></iframe>
                            </body>
                            </html>
                        `);
                    } else {
                        // For other file types, trigger download
                        newWindow.location.href = fileUrl;
                    }
                } else {
                    alert('Please allow pop-ups to view the file.');
                }
            }
        } catch (error) {
            console.error('Error viewing file:', error);
            alert('Failed to view file. Please try again.');
        }
    };

    return (
        <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="size-5 text-blue-600" />
                    <div>
                        <h4 className="font-medium text-blue-900">
                            Associated Lecture Notes & Reference Materials
                        </h4>
                        <p className="text-sm text-blue-700">
                            {notes.length} file{notes.length !== 1 ? 's' : ''} uploaded
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    {notes.map((note) => {
                        const hasFileContent = fileAvailability[note.id] ?? false;
                        return (
                            <div
                                key={note.id}
                                className="flex items-center justify-between p-3 bg-white rounded border border-blue-200 hover:border-blue-300 transition-colors"
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <FileText className="size-5 text-blue-600 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">
                                            {note.originalName}
                                            {!hasFileContent && (
                                                <span className="ml-2 text-xs text-orange-600 font-normal">
                                                    (File not available - please re-upload)
                                                </span>
                                            )}
                                        </p>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                            <span className="uppercase font-medium">
                                                {note.fileType}
                                            </span>
                                            <span>•</span>
                                            <span>{formatFileSize(note.fileSize)}</span>
                                            <span>•</span>
                                            <span>Uploaded {formatDate(note.uploadedAt)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* Download button */}
                                    <button
                                        className={`p-2 rounded transition-colors ${hasFileContent
                                                ? 'text-blue-600 hover:bg-blue-100'
                                                : 'text-gray-400 cursor-not-allowed'
                                            }`}
                                        title={hasFileContent ? 'Download file' : 'File content not available'}
                                        onClick={() => hasFileContent && handleDownload(note)}
                                        disabled={!hasFileContent}
                                    >
                                        <Download className="size-4" />
                                    </button>

                                    {/* View button */}
                                    <button
                                        className={`p-2 rounded transition-colors ${hasFileContent
                                                ? 'text-blue-600 hover:bg-blue-100'
                                                : 'text-gray-400 cursor-not-allowed'
                                            }`}
                                        title={hasFileContent ? 'View file' : 'File content not available'}
                                        onClick={() => hasFileContent && handleView(note)}
                                        disabled={!hasFileContent}
                                    >
                                        <ExternalLink className="size-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs text-blue-600">
                        💡 These materials are used by the AI to provide context-aware grading
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
