import React, { useState, useMemo } from 'react';
import { X, Search, FileText, Copy, Download } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { LectureNote } from '../../types';
import { ProcessingStatusCard } from './ProcessingStatusCard';

interface LectureNotesPreviewProps {
    note: LectureNote;
    onClose: () => void;
    onRetry?: (noteId: string) => void;
    className?: string;
}

export function LectureNotesPreview({
    note,
    onClose,
    onRetry,
    className
}: LectureNotesPreviewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [copied, setCopied] = useState(false);

    // Highlight search matches in content
    const highlightedContent = useMemo(() => {
        if (!note.extractedContent || !searchQuery.trim()) {
            return note.extractedContent || '';
        }

        const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return note.extractedContent.replace(regex, '<mark class="bg-yellow-200 text-gray-900">$1</mark>');
    }, [note.extractedContent, searchQuery]);

    // Count search matches
    const matchCount = useMemo(() => {
        if (!note.extractedContent || !searchQuery.trim()) return 0;
        const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        return (note.extractedContent.match(regex) || []).length;
    }, [note.extractedContent, searchQuery]);

    const handleCopyContent = async () => {
        if (note.extractedContent) {
            await navigator.clipboard.writeText(note.extractedContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownloadContent = () => {
        if (note.extractedContent) {
            const blob = new Blob([note.extractedContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${note.originalName.replace(/\.[^/.]+$/, '')}_extracted.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (date: Date): string => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className={cn(
            "fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4",
            className
        )}>
            <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col">
                <CardHeader className="border-b border-gray-200 flex-shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                                <FileText className="size-6 text-blue-600 flex-shrink-0" />
                                <h2 className="text-xl font-semibold text-gray-900 truncate" title={note.originalName}>
                                    {note.originalName}
                                </h2>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                <span className="uppercase font-medium">{note.fileType}</span>
                                <span>•</span>
                                <span>{formatFileSize(note.fileSize)}</span>
                                {note.wordCount !== undefined && (
                                    <>
                                        <span>•</span>
                                        <span>{note.wordCount.toLocaleString()} words</span>
                                    </>
                                )}
                                {note.metadata.pageCount !== undefined && (
                                    <>
                                        <span>•</span>
                                        <span>{note.metadata.pageCount} pages</span>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                <span>Uploaded: {formatDate(note.uploadedAt)}</span>
                                {note.processedAt && (
                                    <>
                                        <span>•</span>
                                        <span>Processed: {formatDate(note.processedAt)}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="flex-shrink-0"
                        >
                            <X className="size-5" />
                        </Button>
                    </div>

                    {/* Search Bar */}
                    {note.metadata.processingStatus === 'completed' && note.extractedContent && (
                        <div className="mt-4 flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search within content..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            {searchQuery && (
                                <span className="text-sm text-gray-600 whitespace-nowrap">
                                    {matchCount} {matchCount === 1 ? 'match' : 'matches'}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    {note.metadata.processingStatus === 'completed' && note.extractedContent && (
                        <div className="mt-4 flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyContent}
                                className="flex items-center gap-2"
                            >
                                <Copy className="size-4" />
                                {copied ? 'Copied!' : 'Copy Content'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDownloadContent}
                                className="flex items-center gap-2"
                            >
                                <Download className="size-4" />
                                Download Text
                            </Button>
                        </div>
                    )}
                </CardHeader>

                <CardContent className="flex-1 overflow-auto p-6">
                    {/* Processing Status Card for non-completed states */}
                    {note.metadata.processingStatus !== 'completed' && (
                        <ProcessingStatusCard
                            note={note}
                            onRetry={onRetry}
                            showProgress={true}
                        />
                    )}

                    {/* Content Display */}
                    {note.metadata.processingStatus === 'completed' && (
                        <div className="prose prose-sm max-w-none">
                            {note.extractedContent ? (
                                <div
                                    className={cn(
                                        "whitespace-pre-wrap font-mono text-sm leading-relaxed",
                                        note.fileType === 'md' && "prose-headings:font-bold prose-a:text-blue-600"
                                    )}
                                    dangerouslySetInnerHTML={{ __html: highlightedContent }}
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                                    <FileText className="size-12 text-gray-400" />
                                    <div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                                            No Content Available
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            The file was processed but no text content could be extracted.
                                        </p>
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
