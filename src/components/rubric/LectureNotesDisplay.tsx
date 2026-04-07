import { BookOpen, FileText, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { LectureNote } from '../../types';
import { FileStorageService } from '../../utils/fileStorage';

interface LectureNotesDisplayProps {
    notes: LectureNote[];
    className?: string;
}

export function LectureNotesDisplay({ notes }: LectureNotesDisplayProps) {
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
            const url = await FileStorageService.getDownloadUrl(note.id);
            if (url) window.open(url, '_blank');
        } catch (e) {
            console.error('Download failed:', e);
        }
    };

    const handleView = async (note: LectureNote) => {
        try {
            const url = await FileStorageService.getFile(note.id);
            if (url) window.open(url, '_blank');
            else alert('File not available. Please re-upload.');
        } catch (e) {
            console.error('View failed:', e);
        }
    };

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

    return (
        <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="size-5 text-blue-600" />
                    <div>
                        <h4 className="font-medium text-blue-900">Associated Lecture Notes & Reference Materials</h4>
                        <p className="text-sm text-blue-700">{notes.length} file{notes.length !== 1 ? 's' : ''} uploaded</p>
                    </div>
                </div>

                <div className="space-y-2">
                    {notes.map((note) => (
                        <div key={note.id} className="flex items-center justify-between p-3 bg-white rounded border border-blue-200 hover:border-blue-300 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <FileText className="size-5 text-blue-600 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{note.originalName}</p>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                        <span className="uppercase font-medium">{note.fileType}</span>
                                        <span>•</span>
                                        <span>{formatFileSize(note.fileSize)}</span>
                                        <span>•</span>
                                        <span>Uploaded {formatDate(note.uploadedAt)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    className="p-2 rounded text-blue-600 hover:bg-blue-100 transition-colors"
                                    title="Download file"
                                    onClick={() => handleDownload(note)}
                                >
                                    <Download className="size-4" />
                                </button>
                                <button
                                    className="p-2 rounded text-blue-600 hover:bg-blue-100 transition-colors"
                                    title="View file"
                                    onClick={() => handleView(note)}
                                >
                                    <ExternalLink className="size-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-xs text-blue-600">💡 These materials are used by the AI to provide context-aware grading</p>
                </div>
            </CardContent>
        </Card>
    );
}
