import React, { useState, useEffect, useCallback } from 'react';
import { File, Eye, Download, X, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { cn } from '../ui/utils';
import {
    FilePreviewData,
    generateFilePreview,
    formatFileSize,
    SupportedFileType,
    supportsPreview
} from '../../utils/fileProcessing';

interface FilePreviewProps {
    file: File;
    onClose?: () => void;
    onDownload?: (file: File) => void;
    className?: string;
}

export function FilePreview({ file, onClose, onDownload, className }: FilePreviewProps) {
    const [previewData, setPreviewData] = useState<FilePreviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('Initializing...');

    const loadPreview = useCallback(async () => {
        setLoading(true);
        setError(null);
        setProgress('Initializing...');

        try {
            // Update progress for different file types
            if (file.name.toLowerCase().endsWith('.pdf')) {
                setProgress('Loading PDF...');
            } else if (file.name.toLowerCase().endsWith('.docx')) {
                setProgress('Processing Word document...');
            } else {
                setProgress('Reading file...');
            }

            const preview = await generateFilePreview(file);
            setPreviewData(preview);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to generate preview';
            setError(errorMessage);
            console.error('Preview generation error:', err);
        } finally {
            setLoading(false);
            setProgress('');
        }
    }, [file]);

    useEffect(() => {
        loadPreview();
    }, [loadPreview]);

    const getFileTypeColor = (type: SupportedFileType): string => {
        switch (type) {
            case 'pdf':
                return 'bg-red-100 text-red-800';
            case 'docx':
                return 'bg-blue-100 text-blue-800';
            case 'txt':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getFileTypeIcon = (type: SupportedFileType) => {
        return <File className="size-4" />;
    };

    const handleRetry = () => {
        loadPreview();
    };

    if (loading) {
        return (
            <Card className={cn("w-full max-w-2xl", className)}>
                <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <div className="text-center">
                            <p className="text-sm text-gray-600">{progress}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Processing {file.name} ({formatFileSize(file.size)})
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !previewData) {
        return (
            <Card className={cn("w-full max-w-2xl border-red-200", className)}>
                <CardContent className="p-6">
                    <div className="text-center space-y-4">
                        <AlertCircle className="size-12 text-red-400 mx-auto" />
                        <div>
                            <p className="text-sm text-red-600 font-medium">
                                {error || 'Unable to generate preview'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                File: {file.name} ({formatFileSize(file.size)})
                            </p>
                        </div>
                        <div className="flex gap-2 justify-center">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRetry}
                                className="text-xs"
                            >
                                Try Again
                            </Button>
                            {onDownload && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onDownload(file)}
                                    className="text-xs"
                                >
                                    <Download className="size-3 mr-1" />
                                    Download
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("w-full max-w-2xl", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                            {getFileTypeIcon(previewData.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg truncate">{previewData.filename}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                                <Badge
                                    variant="secondary"
                                    className={cn("text-xs", getFileTypeColor(previewData.type))}
                                >
                                    {previewData.type.toUpperCase()}
                                </Badge>
                                <span className="text-sm text-gray-500">
                                    {formatFileSize(previewData.size)}
                                </span>
                                {previewData.metadata.wordCount && (
                                    <>
                                        <span className="text-gray-300">•</span>
                                        <span className="text-sm text-gray-500">
                                            {previewData.metadata.wordCount} words
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                        {onDownload && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onDownload(file)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <Download className="size-4" />
                            </Button>
                        )}
                        {onClose && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <X className="size-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <Separator />

            <CardContent className="p-6">
                {/* File Metadata */}
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div>
                        <span className="font-medium text-gray-700">Last Modified:</span>
                        <p className="text-gray-600">
                            {previewData.metadata.lastModified.toLocaleDateString()} {' '}
                            {previewData.metadata.lastModified.toLocaleTimeString()}
                        </p>
                    </div>
                    {previewData.metadata.pageCount && (
                        <div>
                            <span className="font-medium text-gray-700">Pages:</span>
                            <p className="text-gray-600">{previewData.metadata.pageCount}</p>
                        </div>
                    )}
                </div>

                <Separator className="my-4" />

                {/* Content Preview */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-700 flex items-center gap-2">
                            <Eye className="size-4" />
                            Preview
                        </h4>
                        {!supportsPreview(previewData.type) && (
                            <Badge variant="outline" className="text-xs">
                                Limited Preview
                            </Badge>
                        )}
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                        {previewData.preview ? (
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                                {previewData.preview}
                            </pre>
                        ) : (
                            <div className="text-center py-8">
                                <File className="size-12 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">
                                    No preview available for this file type
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Content will be processed after upload
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Information */}
                {previewData.type !== 'txt' && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> Full content extraction will be performed after upload.
                            {previewData.type === 'pdf' && ' PDF text will be extracted and processed.'}
                            {previewData.type === 'docx' && ' Document content will be extracted and processed.'}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Simplified file preview card for lists
interface FilePreviewCardProps {
    file: File;
    onPreview?: (file: File) => void;
    onRemove?: (file: File) => void;
    className?: string;
}

export function FilePreviewCard({ file, onPreview, onRemove, className }: FilePreviewCardProps) {
    const [previewData, setPreviewData] = useState<FilePreviewData | null>(null);

    useEffect(() => {
        generateFilePreview(file).then(setPreviewData);
    }, [file]);

    const getFileTypeColor = (type: SupportedFileType): string => {
        switch (type) {
            case 'pdf':
                return 'bg-red-100 text-red-800';
            case 'docx':
                return 'bg-blue-100 text-blue-800';
            case 'txt':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Card className={cn("hover:shadow-md transition-shadow", className)}>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <File className="size-5 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <div className="flex items-center space-x-2 mt-1">
                                {previewData && (
                                    <Badge
                                        variant="secondary"
                                        className={cn("text-xs", getFileTypeColor(previewData.type))}
                                    >
                                        {previewData.type.toUpperCase()}
                                    </Badge>
                                )}
                                <span className="text-xs text-gray-500">
                                    {formatFileSize(file.size)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-1 flex-shrink-0">
                        {onPreview && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onPreview(file)}
                                className="text-gray-500 hover:text-blue-600"
                            >
                                <Eye className="size-4" />
                            </Button>
                        )}
                        {onRemove && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onRemove(file)}
                                className="text-gray-500 hover:text-red-600"
                            >
                                <X className="size-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}