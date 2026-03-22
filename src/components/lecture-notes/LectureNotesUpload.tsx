import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, AlertCircle, CheckCircle, Wifi, WifiOff, BookOpen, Link } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { cn } from '../ui/utils';
import { LectureNote, RubricData } from '../../types';
import { RubricSelector } from './RubricSelector';

interface LectureNotesUploadProps {
    onFileUpload: (file: File, associateWithRubric?: string) => Promise<void>;
    onBatchUpload?: (files: File[], associateWithRubrics?: string[]) => Promise<void>;
    onFileRemove?: (noteId: string) => void;
    uploadedNotes?: LectureNote[];
    availableRubrics?: RubricData[];
    maxFileSize?: number; // in MB
    acceptedFormats?: string[];
    disabled?: boolean;
    className?: string;
    onError?: (error: string) => void;
    onSuccess?: (message: string) => void;
    currentRubricId?: string; // For immediate association
    enableBatchAssociation?: boolean;
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

const DEFAULT_ACCEPTED_FORMATS = ['.pdf', '.docx', '.txt', '.md'];
const DEFAULT_MAX_FILE_SIZE = 50; // 50MB for lecture notes

export function LectureNotesUpload({
    onFileUpload,
    onBatchUpload,
    onFileRemove,
    uploadedNotes = [],
    availableRubrics = [],
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
    disabled = false,
    className,
    onError,
    onSuccess,
    currentRubricId,
    enableBatchAssociation = true
}: LectureNotesUploadProps) {
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [processingStatus, setProcessingStatus] = useState<{ [key: string]: string }>({});
    const [uploadErrors, setUploadErrors] = useState<FileUploadError[]>([]);
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
        isOnline: navigator.onLine,
        lastChecked: new Date()
    });
    const [retryingFiles, setRetryingFiles] = useState<Set<string>>(new Set());
    const [selectedRubricIds, setSelectedRubricIds] = useState<string[]>(
        currentRubricId ? [currentRubricId] : []
    );
    const [showRubricSelector, setShowRubricSelector] = useState(false);

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

        // Check for academic document characteristics
        const academicKeywords = ['lecture', 'notes', 'chapter', 'syllabus', 'reading', 'assignment'];
        const hasAcademicIndicator = academicKeywords.some(keyword =>
            file.name.toLowerCase().includes(keyword)
        );

        if (!hasAcademicIndicator && fileExtension === '.txt') {
            // Warn but don't reject - could be valid academic content
            console.warn(`File "${file.name}" may not be academic content. Consider using descriptive filenames.`);
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

        // Handle batch upload if multiple files and batch association is enabled
        if (acceptedFiles.length > 1 && enableBatchAssociation && onBatchUpload && selectedRubricIds.length > 0) {
            // Validate all files first
            const validFiles: File[] = [];
            for (const file of acceptedFiles) {
                const validation = validateFile(file);
                if (!validation.isValid) {
                    addError(file.name, validation.error!, validation.retryable);
                } else {
                    validFiles.push(file);
                }
            }

            if (validFiles.length === 0) return;

            try {
                // Clear any previous errors for valid files
                validFiles.forEach(file => removeError(file.name));

                // Initialize progress for all files
                validFiles.forEach(file => {
                    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
                    setProcessingStatus(prev => ({ ...prev, [file.name]: 'Uploading...' }));
                });

                // Simulate batch upload progress
                const progressInterval = setInterval(() => {
                    setUploadProgress(prev => {
                        const newProgress = { ...prev };
                        validFiles.forEach(file => {
                            const currentProgress = newProgress[file.name] || 0;
                            if (currentProgress < 70) {
                                newProgress[file.name] = currentProgress + 10;
                            }
                        });
                        return newProgress;
                    });
                }, 200);

                // Update status to processing
                setTimeout(() => {
                    validFiles.forEach(file => {
                        setProcessingStatus(prev => ({ ...prev, [file.name]: 'Processing content...' }));
                        setUploadProgress(prev => ({ ...prev, [file.name]: 80 }));
                    });
                }, 1500);

                // Call batch upload handler
                await onBatchUpload(validFiles, selectedRubricIds);

                clearInterval(progressInterval);

                // Complete progress for all files
                validFiles.forEach(file => {
                    setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
                    setProcessingStatus(prev => ({ ...prev, [file.name]: 'Completed' }));
                });

                if (onSuccess) {
                    const rubricCount = selectedRubricIds.length;
                    const fileCount = validFiles.length;
                    onSuccess(`${fileCount} lecture note${fileCount !== 1 ? 's' : ''} uploaded and associated with ${rubricCount} rubric${rubricCount !== 1 ? 's' : ''}`);
                }

                // Clear progress after delay
                setTimeout(() => {
                    validFiles.forEach(file => {
                        setUploadProgress(prev => {
                            const newProgress = { ...prev };
                            delete newProgress[file.name];
                            return newProgress;
                        });
                        setProcessingStatus(prev => {
                            const newStatus = { ...prev };
                            delete newStatus[file.name];
                            return newStatus;
                        });
                    });
                }, 3000);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Batch upload failed';
                validFiles.forEach(file => {
                    addError(file.name, errorMessage, true);
                    setUploadProgress(prev => {
                        const newProgress = { ...prev };
                        delete newProgress[file.name];
                        return newProgress;
                    });
                    setProcessingStatus(prev => {
                        const newStatus = { ...prev };
                        delete newStatus[file.name];
                        return newStatus;
                    });
                });
            }
            return;
        }

        // Handle individual file uploads
        for (const file of acceptedFiles) {
            const validation = validateFile(file);

            if (!validation.isValid) {
                addError(file.name, validation.error!, validation.retryable);
                continue;
            }

            try {
                // Clear any previous errors for this file
                removeError(file.name);

                // Initialize upload progress
                setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
                setProcessingStatus(prev => ({ ...prev, [file.name]: 'Uploading...' }));

                // Simulate upload progress
                const progressInterval = setInterval(() => {
                    setUploadProgress(prev => {
                        const currentProgress = prev[file.name] || 0;
                        if (currentProgress >= 70) {
                            clearInterval(progressInterval);
                            return prev;
                        }
                        return { ...prev, [file.name]: currentProgress + 10 };
                    });
                }, 200);

                // Update status to processing
                setTimeout(() => {
                    setProcessingStatus(prev => ({ ...prev, [file.name]: 'Processing content...' }));
                    setUploadProgress(prev => ({ ...prev, [file.name]: 80 }));
                }, 1500);

                // Determine which rubric to associate with
                const associationRubricId = currentRubricId || (selectedRubricIds.length === 1 ? selectedRubricIds[0] : undefined);

                // Call the upload handler with rubric association
                await onFileUpload(file, associationRubricId);

                // Complete the progress
                setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
                setProcessingStatus(prev => ({ ...prev, [file.name]: 'Completed' }));

                if (onSuccess) {
                    const associationMsg = associationRubricId ? ' and associated with rubric' : '';
                    onSuccess(`Lecture note "${file.name}" uploaded successfully${associationMsg}`);
                }

                // Clear progress after a delay
                setTimeout(() => {
                    setUploadProgress(prev => {
                        const newProgress = { ...prev };
                        delete newProgress[file.name];
                        return newProgress;
                    });
                    setProcessingStatus(prev => {
                        const newStatus = { ...prev };
                        delete newStatus[file.name];
                        return newStatus;
                    });
                }, 3000);

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
                setProcessingStatus(prev => {
                    const newStatus = { ...prev };
                    delete newStatus[file.name];
                    return newStatus;
                });
            }
        }
    }, [disabled, validateFile, onFileUpload, onBatchUpload, addError, removeError, onSuccess, currentRubricId, selectedRubricIds, enableBatchAssociation]);

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop: handleFileDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/plain': ['.txt'],
            'text/markdown': ['.md']
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

    const getProcessingStatusIcon = (note: LectureNote) => {
        switch (note.metadata.processingStatus) {
            case 'pending':
                return <Upload className="size-4 text-blue-500" />;
            case 'processing':
                return <Upload className="size-4 animate-spin text-yellow-500" />;
            case 'completed':
                return <CheckCircle className="size-4 text-green-500" />;
            case 'failed':
                return <AlertCircle className="size-4 text-red-500" />;
            default:
                return <BookOpen className="size-4 text-gray-500" />;
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
                            Lecture note uploads are disabled until connection is restored.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Rubric Association Section */}
            {enableBatchAssociation && availableRubrics.length > 0 && !currentRubricId && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Link className="size-4 text-blue-600" />
                                <span className="text-sm font-medium text-blue-800">
                                    Rubric Association
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowRubricSelector(!showRubricSelector)}
                                className="text-blue-600 hover:text-blue-800"
                            >
                                {showRubricSelector ? 'Hide' : 'Show'} Options
                            </Button>
                        </div>

                        {showRubricSelector && (
                            <div className="space-y-3">
                                <p className="text-sm text-blue-700">
                                    Select rubrics to automatically associate with uploaded lecture notes.
                                    This helps the AI reference relevant materials during grading.
                                </p>
                                <RubricSelector
                                    rubrics={availableRubrics}
                                    selectedRubricIds={selectedRubricIds}
                                    onSelectionChange={setSelectedRubricIds}
                                    placeholder="Choose rubrics for association..."
                                    disabled={disabled}
                                    multiple={true}
                                />
                                {selectedRubricIds.length > 0 && (
                                    <p className="text-xs text-blue-600">
                                        Files will be associated with {selectedRubricIds.length} selected rubric{selectedRubricIds.length !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Current Rubric Association Info */}
            {currentRubricId && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-green-800">
                            <Link className="size-4" />
                            <span className="text-sm font-medium">Auto-Association Enabled</span>
                        </div>
                        <p className="text-sm text-green-700 mt-1">
                            All uploaded files will be automatically associated with the current rubric.
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
                                <BookOpen className={cn(
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
                                            : "Drop lecture notes here"
                                        : "Upload lecture notes & materials"
                                }
                            </h3>

                            <p className="text-sm text-gray-600">
                                {!networkStatus.isOnline
                                    ? "Please check your internet connection and try again"
                                    : isDragReject
                                        ? `Only ${acceptedFormats.join(', ')} files are accepted`
                                        : `Drag and drop academic materials here, or click to browse`
                                }
                            </p>

                            <p className="text-xs text-gray-500">
                                Maximum file size: {maxFileSize}MB • Supported formats: {acceptedFormats.join(', ')}
                            </p>

                            {currentRubricId && (
                                <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    Files will be automatically associated with the current rubric
                                </p>
                            )}

                            {!currentRubricId && selectedRubricIds.length > 0 && (
                                <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                    Files will be associated with {selectedRubricIds.length} selected rubric{selectedRubricIds.length !== 1 ? 's' : ''}
                                </p>
                            )}

                            {enableBatchAssociation && !currentRubricId && selectedRubricIds.length === 0 && availableRubrics.length > 0 && (
                                <p className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                    Tip: Select rubrics above for automatic association
                                </p>
                            )}
                        </div>

                        {!disabled && networkStatus.isOnline && (
                            <Button variant="outline" size="sm">
                                <BookOpen className="size-4 mr-2" />
                                Choose Lecture Notes
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Upload Progress */}
            {Object.keys(uploadProgress).length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <BookOpen className="size-4" />
                            Processing Lecture Notes
                        </h4>
                        <div className="space-y-3">
                            {Object.entries(uploadProgress).map(([fileName, progress]) => (
                                <div key={fileName} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="truncate flex-1">{fileName}</span>
                                        <span className="text-gray-500">{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-2" />
                                    {processingStatus[fileName] && (
                                        <p className="text-xs text-gray-600">{processingStatus[fileName]}</p>
                                    )}
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
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => retryFileUpload(error.file)}
                                                    disabled={retryingFiles.has(error.file)}
                                                    className="text-red-600 border-red-300 hover:bg-red-100"
                                                >
                                                    {retryingFiles.has(error.file) ? 'Retrying...' : 'Retry'}
                                                </Button>
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

            {/* Uploaded Lecture Notes List */}
            {uploadedNotes.length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <BookOpen className="size-4" />
                            Uploaded Lecture Notes ({uploadedNotes.length})
                        </h4>
                        <div className="space-y-2">
                            {uploadedNotes.map((note) => (
                                <div
                                    key={note.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        {getProcessingStatusIcon(note)}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{note.filename}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                                <span>{formatFileSize(note.fileSize)}</span>
                                                <span>•</span>
                                                <span>{note.uploadedAt.toLocaleDateString()}</span>
                                                {note.wordCount && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{note.wordCount.toLocaleString()} words</span>
                                                    </>
                                                )}
                                                {note.associatedRubrics.length > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-blue-600">
                                                            {note.associatedRubrics.length} rubric{note.associatedRubrics.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </>
                                                )}
                                                {note.metadata.processingStatus === 'failed' && note.metadata.processingError && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-red-500">{note.metadata.processingError}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {onFileRemove && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onFileRemove(note.id)}
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