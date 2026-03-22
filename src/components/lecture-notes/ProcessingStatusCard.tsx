import React from 'react';
import { CheckCircle, Clock, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { LectureNote } from '../../types';
import { ProgressIndicator, ProgressStep } from '../ui/progress-indicator';

interface ProcessingStatusCardProps {
    note: LectureNote;
    onRetry?: (noteId: string) => void;
    showProgress?: boolean;
    className?: string;
}

export function ProcessingStatusCard({
    note,
    onRetry,
    showProgress = true,
    className
}: ProcessingStatusCardProps) {
    // Calculate processing progress based on status
    const getProcessingProgress = (): number => {
        switch (note.metadata.processingStatus) {
            case 'pending':
                return 0;
            case 'processing':
                return 50; // Could be enhanced with actual progress tracking
            case 'completed':
                return 100;
            case 'failed':
                return 0;
            default:
                return 0;
        }
    };

    // Create processing steps for progress indicator
    const getProcessingSteps = (): ProgressStep[] => {
        const status = note.metadata.processingStatus;

        return [
            {
                id: 'upload',
                title: 'File Upload',
                description: 'File received',
                status: 'completed'
            },
            {
                id: 'extraction',
                title: 'Content Extraction',
                description: 'Extracting text from file',
                status: status === 'pending' ? 'pending' :
                    status === 'processing' ? 'in-progress' :
                        status === 'completed' ? 'completed' : 'error',
                progress: status === 'processing' ? 50 : undefined
            },
            {
                id: 'indexing',
                title: 'RAG Indexing',
                description: 'Adding to knowledge base',
                status: status === 'completed' ? 'completed' :
                    status === 'failed' ? 'error' : 'pending'
            }
        ];
    };

    const getStatusIcon = () => {
        switch (note.metadata.processingStatus) {
            case 'pending':
                return <Clock className="size-6 text-yellow-500" />;
            case 'processing':
                return <Clock className="size-6 text-blue-500 animate-spin" />;
            case 'completed':
                return <CheckCircle className="size-6 text-green-500" />;
            case 'failed':
                return <AlertCircle className="size-6 text-red-500" />;
        }
    };

    const getStatusTitle = () => {
        switch (note.metadata.processingStatus) {
            case 'pending':
                return 'Processing Pending';
            case 'processing':
                return 'Processing Content';
            case 'completed':
                return 'Processing Complete';
            case 'failed':
                return 'Processing Failed';
        }
    };

    const getStatusDescription = () => {
        switch (note.metadata.processingStatus) {
            case 'pending':
                return 'This file is queued for processing. Content extraction will begin shortly.';
            case 'processing':
                return 'Extracting and analyzing content from your file. This may take a few moments depending on file size.';
            case 'completed':
                return 'Content has been successfully extracted and indexed for RAG integration.';
            case 'failed':
                return 'We encountered an error while processing this file. Please review the error details below.';
        }
    };

    const getStatusColor = () => {
        switch (note.metadata.processingStatus) {
            case 'pending':
                return 'border-yellow-200 bg-yellow-50';
            case 'processing':
                return 'border-blue-200 bg-blue-50';
            case 'completed':
                return 'border-green-200 bg-green-50';
            case 'failed':
                return 'border-red-200 bg-red-50';
        }
    };

    const progress = getProcessingProgress();

    return (
        <Card className={cn('border-2', getStatusColor(), className)}>
            <CardContent className="p-6">
                {/* Header */}
                <div className="flex items-start gap-4 mb-4">
                    <div className="flex-shrink-0">
                        {getStatusIcon()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {getStatusTitle()}
                        </h3>
                        <p className="text-sm text-gray-600">
                            {getStatusDescription()}
                        </p>
                    </div>
                </div>

                {/* File Info */}
                <div className="flex items-center gap-2 mb-4 p-3 bg-white rounded-md border border-gray-200">
                    <FileText className="size-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" title={note.originalName}>
                            {note.originalName}
                        </p>
                        <p className="text-xs text-gray-500">
                            {note.fileType.toUpperCase()} • {(note.fileSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                    </div>
                </div>

                {/* Progress Bar (for processing status) */}
                {showProgress && (note.metadata.processingStatus === 'processing' || note.metadata.processingStatus === 'pending') && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>Processing Progress</span>
                            <span className="font-medium">{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className={cn(
                                    'h-2.5 rounded-full transition-all duration-500',
                                    note.metadata.processingStatus === 'processing' ? 'bg-blue-600' : 'bg-yellow-500'
                                )}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Processing Steps */}
                {showProgress && note.metadata.processingStatus !== 'failed' && (
                    <div className="mb-4">
                        <ProgressIndicator
                            steps={getProcessingSteps()}
                            orientation="vertical"
                            showProgress={true}
                        />
                    </div>
                )}

                {/* Error Details */}
                {note.metadata.processingStatus === 'failed' && note.metadata.processingError && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="size-5 text-red-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <h4 className="text-sm font-medium text-red-900 mb-1">
                                    Error Details
                                </h4>
                                <p className="text-sm text-red-700">
                                    {note.metadata.processingError}
                                </p>
                            </div>
                        </div>

                        {/* Common Issues */}
                        <div className="mt-3 pt-3 border-t border-red-200">
                            <p className="text-xs font-medium text-red-900 mb-2">
                                Common causes:
                            </p>
                            <ul className="text-xs text-red-700 space-y-1">
                                <li>• File is corrupted or password-protected</li>
                                <li>• Unsupported file format variation</li>
                                <li>• File contains only images without extractable text</li>
                                <li>• File encoding or character set issues</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Retry Button */}
                {note.metadata.processingStatus === 'failed' && onRetry && (
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => onRetry(note.id)}
                            className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
                        >
                            <RefreshCw className="size-4" />
                            Retry Processing
                        </Button>
                    </div>
                )}

                {/* Success Stats */}
                {note.metadata.processingStatus === 'completed' && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-md border border-gray-200">
                        {note.wordCount !== undefined && (
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Words Extracted</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {note.wordCount.toLocaleString()}
                                </p>
                            </div>
                        )}
                        {note.metadata.pageCount !== undefined && (
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Pages Processed</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {note.metadata.pageCount}
                                </p>
                            </div>
                        )}
                        {note.processedAt && (
                            <div className="col-span-2">
                                <p className="text-xs text-gray-500 mb-1">Completed At</p>
                                <p className="text-sm text-gray-700">
                                    {new Date(note.processedAt).toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
