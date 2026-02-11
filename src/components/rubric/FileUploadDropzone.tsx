import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { RetryButton } from '../ui/retry-button';
import { cn } from '../ui/utils';
import { UploadedFile } from '../../types';

interface FileUploadDropzoneProps {
    onFileUpload: (file: File) => Promise<void>;
    onFileRemove?: (fileId: string) => void;
    uploadedFiles?: UploadedFile[];
    maxFileSize?: number; // in MB
    acceptedFormats?: string[];
    disabled?: boolean;
    className?: string;
    onError?: (error: string) => void;
    onSuccess?: (message: string) => void;
}

interface FileUploadError {
    file: string;
    error: string;
    timestamp: Date;
    retryable: boolean;
}

interface NetworkStatus {
    isOnline: boolean;
    lastChecked: Date;
}

const DEFAULT_ACCEPTED_FORMATS = ['.pdf', '.docx', '.txt'];
const DEFAULT_MAX_FILE_SIZE = 10; // 10MB

export function FileUploadDropzone({
    onFileUpload,
    onFileRemove,
    uploadedFiles = [],
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
    disabled = false,
    className,
    onError,
    onSuccess
}: FileUploadDropzoneProps) {
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [uploadErrors, setUploadErrors] = useState<FileUploadError[]>([]);
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
        isOnline: navigator.onLine,
        lastChecked: new Date()
    });
    const [retryingFiles, setRetryingFiles] = useState<Set<string>>(new Set());

    // Network status monitoring
    React.useEffect(() => {
        const handleOnline = () => {
            setNetworkStatus({
                isOnline: true,
                lastChecked: new Date()
            });
        };

        const handleOffline = () => {
            setNetworkStatus({
                isOnline: false,
                lastChecked: new Date()
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const validateFile = useCallback((file: File): { isValid: boolean; error?: string; retryable?: boolean } => {
        // Check network connectivity
        if (!networkStatus.isOnline) {
            return {
                isValid: false,
                error: 'No internet connection. Please check your network and try again.',
                retryable: true
            };
        }

        // Check file size
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > maxFileSize) {
            return {
                isValid: false,
                error: `File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed size of ${maxFileSize}MB. Please compress your file and try again.`,
                retryable: false
            };
        }

        // Check file format
        const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!acceptedFormats.includes(fileExtension)) {
            return {
                isValid: false,
                error: `File format ${fileExtension} is not supported. Accepted formats: ${acceptedFormats.join(', ')}`,
                retryable: false
            };
        }

        // Check for empty files
        if (file.size === 0) {
            return {
                isValid: false,
                error: 'File appears to be empty. Please select a valid file.',
                retryable: false
            };
        }

        // Check for suspicious file names
        if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
            return {
                isValid: false,
                error: 'Invalid file name. Please rename your file and try again.',
                retryable: false
            };
        }

        return { isValid: true };
    }, [maxFileSize, acceptedFormats, networkStatus.isOnline]);

    const addError = useCallback((file: string, error: string, retryable: boolean = true) => {
        const newError: FileUploadError = {
            file,
            error,
            timestamp: new Date(),
            retryable
        };

        setUploadErrors(prev => {
            // Remove any existing error for this file
            const filtered = prev.filter(e => e.file !== file);
            return [...filtered, newError];
        });

        if (onError) {
            onError(`${file}: ${error}`);
        }
    }, [onError]);

    const removeError = useCallback((file: string) => {
        setUploadErrors(prev => prev.filter(e => e.file !== file));
    }, []);

    const retryFileUpload = useCallback(async (fileName: string) => {
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (!fileInput?.files) return;

        const file = Array.from(fileInput.files).find(f => f.name === fileName);
        if (!file) return;

        setRetryingFiles(prev => new Set([...prev, fileName]));

        try {
            await handleFileDrop([file]);
        } finally {
            setRetryingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(fileName);
                return newSet;
            });
        }
    }, []);

    const handleFileDrop = useCallback(async (acceptedFiles: File[]) => {
        if (disabled) return;

        for (const file of acceptedFiles) {
            const validation = validateFile(file);

            if (!validation.isValid) {
                addError(file.name, validation.error!, validation.retryable);
                continue;
            }

            try {
                // Clear any previous errors for this file
                removeError(file.name);

                // Simulate upload progress (in real implementation, this would come from the upload service)
                setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

                // Simulate progress updates
                const progressInterval = setInterval(() => {
                    setUploadProgress(prev => {
                        const currentProgress = prev[file.name] || 0;
                        if (currentProgress >= 90) {
                            clearInterval(progressInterval);
                            return prev;
                        }
                        return { ...prev, [file.name]: currentProgress + 10 };
                    });
                }, 200);

                await onFileUpload(file);

                // Complete the progress
                setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));

                if (onSuccess) {
                    onSuccess(`File "${file.name}" uploaded successfully`);
                }

                // Clear progress after a delay
                setTimeout(() => {
                    setUploadProgress(prev => {
                        const newProgress = { ...prev };
                        delete newProgress[file.name];
                        return newProgress;
                    });
                }, 2000);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Upload failed';
                const isNetworkError = errorMessage.includes('network') ||
                    errorMessage.includes('fetch') ||
                    errorMessage.includes('connection');

                addError(file.name, errorMessage, isNetworkError);

                // Clear progress on error
                setUploadProgress(prev => {
                    const newProgress = { ...prev };
                    delete newProgress[file.name];
                    return newProgress;
                });
            }
        }
    }, [disabled, validateFile, onFileUpload, addError, removeError, onSuccess]);

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop: handleFileDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt']
        },
        maxSize: maxFileSize * 1024 * 1024,
        disabled,
        multiple: true
    });

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getFileStatusIcon = (file: UploadedFile) => {
        switch (file.status) {
            case 'uploading':
                return <Upload className="size-4 animate-pulse text-blue-500" />;
            case 'processing':
                return <Upload className="size-4 animate-spin text-yellow-500" />;
            case 'completed':
                return <CheckCircle className="size-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="size-4 text-red-500" />;
            default:
                return <File className="size-4 text-gray-500" />;
        }
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Network Status Indicator */}
            {!networkStatus.isOnline && (
                <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-yellow-800">
                            <WifiOff className="size-4" />
                            <span className="text-sm font-medium">No internet connection</span>
                        </div>
                        <p className="text-sm text-yellow-700 mt-1">
                            File uploads are disabled until connection is restored.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Dropzone */}
            <Card className={cn(
                "border-2 border-dashed transition-colors cursor-pointer",
                isDragActive && !isDragReject && "border-blue-500 bg-blue-50",
                isDragReject && "border-red-500 bg-red-50",
                (disabled || !networkStatus.isOnline) && "opacity-50 cursor-not-allowed"
            )}>
                <CardContent className="p-8">
                    <div
                        {...getRootProps()}
                        className="flex flex-col items-center justify-center text-center space-y-4"
                    >
                        <input {...getInputProps()} />

                        <div className={cn(
                            "p-4 rounded-full",
                            isDragActive && !isDragReject && "bg-blue-100",
                            isDragReject && "bg-red-100",
                            !isDragActive && "bg-gray-100"
                        )}>
                            {networkStatus.isOnline ? (
                                <Upload className={cn(
                                    "size-8",
                                    isDragActive && !isDragReject && "text-blue-500",
                                    isDragReject && "text-red-500",
                                    !isDragActive && "text-gray-500"
                                )} />
                            ) : (
                                <WifiOff className="size-8 text-gray-400" />
                            )}
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">
                                {!networkStatus.isOnline
                                    ? "Connection required"
                                    : isDragActive
                                        ? isDragReject
                                            ? "Invalid file type"
                                            : "Drop files here"
                                        : "Upload rubric files"
                                }
                            </h3>

                            <p className="text-sm text-gray-600">
                                {!networkStatus.isOnline
                                    ? "Please check your internet connection and try again"
                                    : isDragReject
                                        ? `Only ${acceptedFormats.join(', ')} files are accepted`
                                        : `Drag and drop files here, or click to browse`
                                }
                            </p>

                            <p className="text-xs text-gray-500">
                                Maximum file size: {maxFileSize}MB • Supported formats: {acceptedFormats.join(', ')}
                            </p>
                        </div>

                        {!disabled && networkStatus.isOnline && (
                            <Button variant="outline" size="sm">
                                Choose Files
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Upload Progress */}
            {Object.keys(uploadProgress).length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-3">Uploading Files</h4>
                        <div className="space-y-3">
                            {Object.entries(uploadProgress).map(([fileName, progress]) => (
                                <div key={fileName} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="truncate flex-1">{fileName}</span>
                                        <span className="text-gray-500">{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-2" />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Upload Errors */}
            {uploadErrors.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                        <h4 className="text-sm font-medium text-red-800 mb-3 flex items-center gap-2">
                            <AlertCircle className="size-4" />
                            Upload Errors ({uploadErrors.length})
                        </h4>
                        <div className="space-y-3">
                            {uploadErrors.map((error, index) => (
                                <div key={index} className="bg-white rounded p-3 border border-red-200">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-red-800 truncate">
                                                {error.file}
                                            </div>
                                            <div className="text-sm text-red-700 mt-1">
                                                {error.error}
                                            </div>
                                            <div className="text-xs text-red-600 mt-1">
                                                {error.timestamp.toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {error.retryable && (
                                                <RetryButton
                                                    onRetry={() => retryFileUpload(error.file)}
                                                    disabled={retryingFiles.has(error.file)}
                                                    size="sm"
                                                    maxRetries={3}
                                                    retryDelay={2000}
                                                >
                                                    {retryingFiles.has(error.file) ? 'Retrying...' : 'Retry'}
                                                </RetryButton>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeError(error.file)}
                                                className="text-red-600 hover:text-red-800 p-1"
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-red-200">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setUploadErrors([])}
                                className="text-red-700 border-red-300 hover:bg-red-100"
                            >
                                Clear All Errors
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Uploaded Files List */}
            {uploadedFiles.length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-3">Uploaded Files</h4>
                        <div className="space-y-2">
                            {uploadedFiles.map((file) => (
                                <div
                                    key={file.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {getFileStatusIcon(file)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{file.filename}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>{formatFileSize(file.size)}</span>
                                                <span>•</span>
                                                <span>{file.uploadDate.toLocaleDateString()}</span>
                                                {file.status === 'error' && file.errorMessage && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-red-500">{file.errorMessage}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {onFileRemove && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onFileRemove(file.id)}
                                            className="text-gray-500 hover:text-red-500"
                                        >
                                            <X className="size-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}