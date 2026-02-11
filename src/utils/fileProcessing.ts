import { UploadedFile } from '../types';

// Supported file formats and their MIME types
export const SUPPORTED_FILE_FORMATS = {
    pdf: {
        extensions: ['.pdf'],
        mimeTypes: ['application/pdf'],
        maxSize: 10 * 1024 * 1024, // 10MB
    },
    docx: {
        extensions: ['.docx'],
        mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        maxSize: 10 * 1024 * 1024, // 10MB
    },
    txt: {
        extensions: ['.txt'],
        mimeTypes: ['text/plain'],
        maxSize: 5 * 1024 * 1024, // 5MB
    },
};

export type SupportedFileType = keyof typeof SUPPORTED_FILE_FORMATS;

// File validation result
export interface FileValidationResult {
    isValid: boolean;
    error?: string;
    fileType?: SupportedFileType;
    warnings?: string[];
}

// File content extraction result
export interface FileContentResult {
    success: boolean;
    content?: string;
    metadata?: {
        pageCount?: number;
        wordCount?: number;
        characterCount?: number;
        extractedAt: Date;
        extractionMethod?: string;
    };
    error?: string;
}

// File preview data
export interface FilePreviewData {
    filename: string;
    size: number;
    type: SupportedFileType;
    preview: string; // First few lines or summary
    metadata: {
        pageCount?: number;
        wordCount?: number;
        lastModified: Date;
    };
}

/**
 * Validates a file against supported formats and size limits
 */
export function validateFile(file: File): FileValidationResult {
    const result: FileValidationResult = {
        isValid: false,
        warnings: [],
    };

    // Get file extension
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!extension || extension === '.') {
        result.error = 'File must have a valid extension';
        return result;
    }

    // Find matching file type
    let matchedType: SupportedFileType | undefined;
    const fileTypes = Object.keys(SUPPORTED_FILE_FORMATS) as SupportedFileType[];

    for (const type of fileTypes) {
        const config = SUPPORTED_FILE_FORMATS[type];
        if (config.extensions.includes(extension)) {
            matchedType = type;
            break;
        }
    }

    if (!matchedType) {
        const supportedExtensions = Object.values(SUPPORTED_FILE_FORMATS)
            .flatMap(config => config.extensions)
            .join(', ');
        result.error = `Unsupported file format. Supported formats: ${supportedExtensions}`;
        return result;
    }

    result.fileType = matchedType;
    const config = SUPPORTED_FILE_FORMATS[matchedType];

    // Validate MIME type if available
    if (file.type && !config.mimeTypes.includes(file.type)) {
        result.warnings?.push(`File MIME type (${file.type}) doesn't match expected type for ${extension} files`);
    }

    // Validate file size
    if (file.size > config.maxSize) {
        const maxSizeMB = config.maxSize / (1024 * 1024);
        const fileSizeMB = file.size / (1024 * 1024);
        result.error = `File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed size of ${maxSizeMB}MB for ${extension} files`;
        return result;
    }

    // Check for empty files
    if (file.size === 0) {
        result.error = 'File is empty';
        return result;
    }

    // Validate filename
    if (file.name.length > 255) {
        result.error = 'Filename is too long (maximum 255 characters)';
        return result;
    }

    // Check for potentially problematic characters in filename
    const problematicChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (problematicChars.test(file.name)) {
        result.warnings?.push('Filename contains special characters that may cause issues');
    }

    result.isValid = true;
    return result;
}

/**
 * Extracts text content from supported file formats
 */
export async function extractFileContent(file: File): Promise<FileContentResult> {
    const validation = validateFile(file);
    if (!validation.isValid) {
        return {
            success: false,
            error: validation.error || 'File validation failed',
        };
    }

    try {
        switch (validation.fileType) {
            case 'txt':
                return await extractTextContent(file);
            case 'pdf':
                return await extractPdfContent(file);
            case 'docx':
                return await extractDocxContent(file);
            default:
                return {
                    success: false,
                    error: `Content extraction not implemented for ${validation.fileType} files`,
                };
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during content extraction',
        };
    }
}

/**
 * Extracts content from plain text files
 */
async function extractTextContent(file: File): Promise<FileContentResult> {
    try {
        const content = await file.text();
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

        return {
            success: true,
            content,
            metadata: {
                wordCount,
                characterCount: content.length,
                extractedAt: new Date(),
                extractionMethod: 'browser-text-api',
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to read text file',
        };
    }
}

/**
 * Extracts content from PDF files using Python backend
 */
async function extractPdfContent(file: File): Promise<FileContentResult> {
    console.log('Starting PDF extraction via Python backend for:', file.name, 'Size:', file.size);

    try {
        // Create FormData to send file to backend
        const formData = new FormData();
        formData.append('file', file);

        console.log('Sending file to Python backend for processing...');

        // Send to Python backend (adjust URL as needed)
        const response = await fetch('http://localhost:5000/extract-pdf', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Backend request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Python backend response:', result);

        if (result.success) {
            return {
                success: true,
                content: result.content,
                metadata: {
                    pageCount: result.metadata?.page_count,
                    wordCount: result.metadata?.word_count,
                    characterCount: result.metadata?.character_count,
                    extractedAt: new Date(),
                    extractionMethod: result.metadata?.extraction_method,
                },
            };
        } else {
            return {
                success: false,
                error: result.error || 'Python backend processing failed',
            };
        }

    } catch (error) {
        console.error('PDF extraction via Python backend failed:', error);

        // Fallback error message with helpful instructions
        const errorMessage = error instanceof Error ? error.message : 'Failed to extract PDF content';
        const isConnectionError = errorMessage.includes('fetch') || errorMessage.includes('Failed to fetch');

        return {
            success: false,
            error: isConnectionError
                ? 'Cannot connect to PDF extraction service. Make sure the Python backend is running on http://localhost:5000'
                : errorMessage,
        };
    }
}

/**
 * Extracts content from DOCX files using mammoth.js
 */
async function extractDocxContent(file: File): Promise<FileContentResult> {
    try {
        // Dynamic import to avoid bundling issues
        const mammoth = await import('mammoth');

        // Convert file to array buffer
        const arrayBuffer = await file.arrayBuffer();

        // Extract text from DOCX
        const result = await mammoth.extractRawText({ arrayBuffer });

        const content = result.value;
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

        return {
            success: true,
            content,
            metadata: {
                wordCount,
                characterCount: content.length,
                extractedAt: new Date(),
                extractionMethod: 'mammoth-js',
            },
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to extract DOCX content',
        };
    }
}

/**
 * Generates preview data for a file
 */
export async function generateFilePreview(file: File): Promise<FilePreviewData | null> {
    const validation = validateFile(file);
    if (!validation.isValid || !validation.fileType) {
        return null;
    }

    const basePreview: FilePreviewData = {
        filename: file.name,
        size: file.size,
        type: validation.fileType,
        preview: '',
        metadata: {
            lastModified: new Date(file.lastModified),
        },
    };

    // For text files, we can generate a preview
    if (validation.fileType === 'txt') {
        try {
            const content = await file.text();
            const lines = content.split('\n');
            const previewLines = lines.slice(0, 5); // First 5 lines
            const preview = previewLines.join('\n');
            const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

            return {
                ...basePreview,
                preview: preview + (lines.length > 5 ? '\n...' : ''),
                metadata: {
                    ...basePreview.metadata,
                    wordCount,
                },
            };
        } catch (error) {
            // If we can't read the content, return basic preview
            return {
                ...basePreview,
                preview: 'Unable to preview file content',
            };
        }
    }

    // For PDF and DOCX files, try to extract content for preview with better error handling
    if (validation.fileType === 'pdf' || validation.fileType === 'docx') {
        const fileTypeUpper = validation.fileType.toUpperCase();

        try {
            console.log(`Starting preview generation for ${validation.fileType} file:`, file.name);

            // Set a shorter timeout for preview generation (15 seconds)
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Preview timeout after 15 seconds')), 15000);
            });

            const previewPromise = async () => {
                console.log('Attempting content extraction...');
                const contentResult = await extractFileContent(file);
                console.log('Content extraction result:', {
                    success: contentResult.success,
                    hasContent: !!contentResult.content,
                    contentLength: contentResult.content?.length,
                    error: contentResult.error
                });

                if (contentResult.success && contentResult.content) {
                    const lines = contentResult.content.split('\n').filter(line => line.trim().length > 0);
                    const previewLines = lines.slice(0, 5); // First 5 non-empty lines
                    const preview = previewLines.join('\n');

                    return {
                        ...basePreview,
                        preview: preview + (lines.length > 5 ? '\n...' : ''),
                        metadata: {
                            ...basePreview.metadata,
                            wordCount: contentResult.metadata?.wordCount,
                            pageCount: contentResult.metadata?.pageCount,
                        },
                    };
                } else {
                    // If extraction failed, return a preview with the error info
                    return {
                        ...basePreview,
                        preview: `${fileTypeUpper} processing failed: ${contentResult.error || 'Unknown error'}\n\nFile can still be uploaded and processed on the server.`,
                        metadata: {
                            ...basePreview.metadata,
                        },
                    };
                }
            };

            return await Promise.race([previewPromise(), timeoutPromise]);
        } catch (error) {
            // Fall through to basic preview if extraction fails or times out
            console.warn('Preview generation failed:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            return {
                ...basePreview,
                preview: `${fileTypeUpper} preview failed: ${errorMessage}\n\nThis is normal for large or complex files. The file can still be uploaded and processed.`,
                metadata: {
                    ...basePreview.metadata,
                },
            };
        }
    }

    // For PDF and DOCX files, return basic info if extraction failed
    const fileType = (validation.fileType as string) || 'FILE';
    return {
        ...basePreview,
        preview: `${fileType.toUpperCase()} - Content extraction available`,
    };
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Checks if a file type supports client-side preview
 */
export function supportsPreview(fileType: SupportedFileType): boolean {
    return ['txt', 'pdf', 'docx'].includes(fileType);
}

/**
 * Gets the appropriate icon name for a file type
 */
export function getFileTypeIcon(fileType: SupportedFileType): string {
    switch (fileType) {
        case 'pdf':
            return 'file-text'; // or 'file-pdf' if available
        case 'docx':
            return 'file-text'; // or 'file-word' if available
        case 'txt':
            return 'file-text';
        default:
            return 'file';
    }
}

/**
 * Creates a safe filename by removing or replacing problematic characters
 */
export function sanitizeFilename(filename: string): string {
    // Remove or replace problematic characters
    const sanitized = filename
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Replace problematic chars with underscore
        .replace(/\s+/g, '_') // Replace spaces with underscores
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores

    // Ensure filename isn't too long
    if (sanitized.length > 200) {
        const extension = sanitized.split('.').pop();
        const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf('.'));
        const truncatedName = nameWithoutExt.substring(0, 200 - (extension?.length || 0) - 1);
        return extension ? `${truncatedName}.${extension}` : truncatedName;
    }

    return sanitized || 'unnamed_file';
}

/**
 * Validates multiple files and returns validation results
 */
export function validateMultipleFiles(files: File[]): {
    valid: File[];
    invalid: Array<{ file: File; error: string }>;
    warnings: Array<{ file: File; warnings: string[] }>;
} {
    const valid: File[] = [];
    const invalid: Array<{ file: File; error: string }> = [];
    const warnings: Array<{ file: File; warnings: string[] }> = [];

    for (const file of files) {
        const validation = validateFile(file);

        if (validation.isValid) {
            valid.push(file);
            if (validation.warnings && validation.warnings.length > 0) {
                warnings.push({ file, warnings: validation.warnings });
            }
        } else {
            invalid.push({ file, error: validation.error || 'Unknown validation error' });
        }
    }

    return { valid, invalid, warnings };
}