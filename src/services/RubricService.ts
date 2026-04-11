import {
    RubricData,
    RubricQuestion,
    ScoringCriterion,
    UploadedFile,
    Assignment,
    Course,
    ApiResponse,
    PaginatedResponse,
    RubricUploadResponse,
    RubricListResponse
} from '../types';
import { JsonStorageService } from '../utils/jsonStorage';

// Global mock data - shared across all service instances
let globalMockRubrics: RubricData[] = [];
let isInitialized = false;

const mockCourses: Course[] = [
    { id: "course-1", name: "Psychology 101", code: "SOSC2010", semester: "Fall 2024" },
    { id: "course-2", name: "Cognitive Science", code: "COGS201", semester: "Fall 2024" }
];

const mockAssignments: Assignment[] = [
    {
        id: "assignment-1",
        title: "Planning Fallacy Essay",
        description: "Analyze the concept of planning fallacy and its psychological factors",
        courseId: "course-1",
        dueDate: new Date('2024-02-15'),
        rubricId: "rubric-1",
        createdAt: new Date('2024-01-10')
    }
];

export class RubricService {
    private baseUrl: string;
    private static cache: Map<string, any> = new Map(); // Static cache shared across instances

    constructor(baseUrl: string = '/api') {
        this.baseUrl = baseUrl;
        this.initializeStorage();
    }

    // Initialize storage from JSON file
    private async initializeStorage(): Promise<void> {
        if (isInitialized) return;

        try {
            console.log('Initializing RubricService storage...');
            const storedRubrics = await JsonStorageService.initializeStorage();
            globalMockRubrics = storedRubrics.map(r => ({
                ...r,
                lectureNotes: r.lectureNotes || [],
            }));
            isInitialized = true;
            console.log(`Loaded ${globalMockRubrics.length} rubrics from storage`);
        } catch (error) {
            console.error('Failed to initialize storage:', error);
            globalMockRubrics = [];
            isInitialized = true;
        }
    }

    // Save rubrics to persistent storage
    private async saveToStorage(): Promise<void> {
        try {
            await JsonStorageService.saveRubrics(globalMockRubrics);
            console.log('Rubrics saved to persistent storage');
        } catch (error) {
            console.error('Failed to save rubrics to storage:', error);
        }
    }

    // Simulate API delay
    private async simulateApiDelay(ms: number = 100): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Cache management
    private getCacheKey(method: string, params: any[]): string {
        return `${method}-${JSON.stringify(params)}`;
    }

    private getFromCache<T>(key: string): T | null {
        return RubricService.cache.get(key) || null;
    }

    private setCache<T>(key: string, data: T): void {
        RubricService.cache.set(key, data);
    }

    private clearCache(): void {
        console.log('Cache size before clear:', RubricService.cache.size);
        console.log('Cache keys before clear:', Array.from(RubricService.cache.keys()));
        RubricService.cache.clear();
        console.log('Cache size after clear:', RubricService.cache.size);
    }

    // Clear cache for specific method
    private clearCacheForMethod(method: string, params: any[]): void {
        const cacheKey = this.getCacheKey(method, params);
        RubricService.cache.delete(cacheKey);
    }

    // File upload handling utilities
    validateFile(file: File): { isValid: boolean; error?: string } {
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        const maxSize = 10 * 1024 * 1024; // 10MB

        if (!allowedTypes.includes(file.type)) {
            return {
                isValid: false,
                error: 'Invalid file format. Please upload PDF, DOCX, or TXT files only.'
            };
        }

        if (file.size > maxSize) {
            return {
                isValid: false,
                error: 'File size exceeds 10MB limit. Please compress your file and try again.'
            };
        }

        return { isValid: true };
    }

    // Rubric validation functions
    validateRubric(rubricData: Partial<RubricData>): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (!rubricData.title || rubricData.title.trim().length === 0) {
            errors.push('Rubric title is required');
        }

        if (!rubricData.questions || rubricData.questions.length === 0) {
            errors.push('At least one question is required');
        }

        if (rubricData.questions) {
            rubricData.questions.forEach((question, index) => {
                if (!question.title || question.title.trim().length === 0) {
                    errors.push(`Question ${index + 1}: Title is required`);
                }

                if (question.minScore < 0) {
                    errors.push(`Question ${index + 1}: Minimum score cannot be negative`);
                }

                if (question.maxScore <= question.minScore) {
                    errors.push(`Question ${index + 1}: Maximum score must be greater than minimum score`);
                }

                // Validate scoring criteria
                if (question.scoringCriteria && question.scoringCriteria.length > 0) {
                    const sortedCriteria = [...question.scoringCriteria].sort((a, b) => a.minPoints - b.minPoints);

                    for (let i = 0; i < sortedCriteria.length - 1; i++) {
                        if (sortedCriteria[i].maxPoints >= sortedCriteria[i + 1].minPoints) {
                            errors.push(`Question ${index + 1}: Overlapping score ranges in criteria`);
                            break;
                        }
                    }
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Enhanced file upload with retry mechanism
    async uploadRubricFile(file: File, courseId?: string, retryCount: number = 0): Promise<RubricUploadResponse> {
        const maxRetries = 3;
        const retryDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff

        try {
            const validation = this.validateFile(file);
            if (!validation.isValid) {
                return {
                    data: {} as RubricData,
                    success: false,
                    message: validation.error || 'File validation failed'
                };
            }

            // Call the Python backend API with timeout
            const formData = new FormData();
            formData.append('file', file);

            console.log('Uploading file to Python backend:', file.name, `(attempt ${retryCount + 1}/${maxRetries + 1})`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

            const response = await fetch('http://localhost:5000/extract-pdf', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const result = await response.json();
            console.log('Python backend response:', result);

            if (!response.ok || !result.success) {
                const errorMessage = result.error || `HTTP ${response.status}: ${response.statusText}`;

                // Check if error is retryable
                const isRetryable = response.status >= 500 ||
                    response.status === 408 ||
                    response.status === 429 ||
                    errorMessage.includes('network') ||
                    errorMessage.includes('timeout');

                if (isRetryable && retryCount < maxRetries) {
                    console.log(`Retrying upload in ${retryDelay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    return this.uploadRubricFile(file, courseId, retryCount + 1);
                }

                return {
                    data: {} as RubricData,
                    success: false,
                    message: `Failed to process file: ${errorMessage}${retryCount > 0 ? ` (after ${retryCount + 1} attempts)` : ''}`
                };
            }

            console.log('Backend success, creating rubric...');

            // Create a rubric from the extracted content
            const extractedContent = result.content || '';
            const metadata = result.metadata || {};
            const parsed = result.rubric; // GPT-parsed structure, may be null if parsing failed

            const ts = Date.now();

            // Build questions from GPT-parsed structure, or fall back to a single placeholder
            const questions = parsed?.questions?.length
                ? parsed.questions.map((q: any, qi: number) => ({
                    id: q.id || `q-${ts}-${qi}`,
                    title: q.title || `Question ${qi + 1}`,
                    description: q.description || '',
                    minScore: q.minScore ?? 0,
                    maxScore: q.maxScore ?? 10,
                    scoringCriteria: (q.scoringCriteria || []).map((sc: any, si: number) => ({
                        id: sc.id || `c-${ts}-${qi}-${si}`,
                        scoreRange: sc.scoreRange || '',
                        description: sc.description || '',
                        minPoints: sc.minPoints ?? 0,
                        maxPoints: sc.maxPoints ?? 10,
                    })),
                    criteria: (q.criteria || []).map((cr: any, ci: number) => ({
                        id: cr.id || `crit-${ts}-${qi}-${ci}`,
                        name: cr.name || `Criterion ${ci + 1}`,
                        scoreLevels: (cr.scoreLevels || []).map((sl: any, si: number) => ({
                            id: sl.id || `sl-${ts}-${qi}-${ci}-${si}`,
                            scoreRange: sl.scoreRange || '',
                            description: sl.description || '',
                            minPoints: sl.minPoints ?? 0,
                            maxPoints: sl.maxPoints ?? 10,
                        })),
                    })),
                }))
                : [{
                    id: `q-${ts}`,
                    title: 'Content Analysis',
                    description: `Extracted from ${file.name} — edit to add proper criteria`,
                    minScore: 0,
                    maxScore: 10,
                    scoringCriteria: [],
                    criteria: [],
                }];

            const totalMax = questions.reduce((sum: number, q: any) => sum + (q.maxScore || 0), 0);

            const newRubric: RubricData = {
                id: `rubric-${ts}`,
                title: parsed?.title || file.name.replace(/\.[^/.]+$/, ''),
                description: parsed?.description || `Extracted from ${file.name} (${metadata.page_count || 0} pages, ${metadata.word_count || 0} words)`,
                questions,
                totalMinPoints: 0,
                totalMaxPoints: totalMax || 10,
                courseId,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            globalMockRubrics.push(newRubric);

            // Save to persistent storage
            await this.saveToStorage();

            // Clear cache for all possible getRubrics combinations
            console.log('Clearing all cache before refresh...');
            this.clearCache(); // Clear all cache

            console.log('Rubric created successfully:', newRubric);

            return {
                data: newRubric,
                success: true,
                message: `File uploaded successfully! Extracted ${metadata.word_count || 0} words from ${metadata.page_count || 0} pages.${retryCount > 0 ? ` (succeeded after ${retryCount + 1} attempts)` : ''}`,
                fileId: `file-${Date.now()}`,
                processingStatus: 'completed'
            };
        } catch (error) {
            console.error('Upload error:', error);

            // Handle specific error types
            let errorMessage = 'Failed to upload rubric file';
            let isRetryable = false;

            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    errorMessage = 'Upload timed out. Please try again with a smaller file.';
                    isRetryable = true;
                } else if (error.message.includes('fetch')) {
                    errorMessage = 'Network error. Please check your connection and try again.';
                    isRetryable = true;
                } else {
                    errorMessage = error.message;
                    isRetryable = error.message.includes('network') ||
                        error.message.includes('timeout') ||
                        error.message.includes('connection');
                }
            }

            // Retry if appropriate
            if (isRetryable && retryCount < maxRetries) {
                console.log(`Retrying upload due to error in ${retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                return this.uploadRubricFile(file, courseId, retryCount + 1);
            }

            return {
                data: {} as RubricData,
                success: false,
                message: `${errorMessage}${retryCount > 0 ? ` (failed after ${retryCount + 1} attempts)` : ''}`
            };
        }
    }

    // Create rubric manually
    async createRubric(rubricData: Partial<RubricData>): Promise<ApiResponse<RubricData>> {
        await this.simulateApiDelay();

        try {
            console.log('RubricService.createRubric: Received data:', rubricData);

            const validation = this.validateRubric(rubricData);
            if (!validation.isValid) {
                console.error('RubricService.createRubric: Validation failed:', validation.errors);
                return {
                    data: {} as RubricData,
                    success: false,
                    message: `Validation failed: ${validation.errors.join(', ')}`
                };
            }

            const newRubric: RubricData = {
                id: `rubric-${Date.now()}`,
                title: rubricData.title!,
                description: rubricData.description || '',
                questions: rubricData.questions || [],
                totalMinPoints: rubricData.questions?.reduce((sum, q) => sum + q.minScore, 0) || 0,
                totalMaxPoints: rubricData.questions?.reduce((sum, q) => sum + q.maxScore, 0) || 0,
                courseId: rubricData.courseId,
                assignmentId: rubricData.assignmentId,
                lectureNotes: rubricData.lectureNotes || [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            console.log('RubricService.createRubric: Created rubric:', newRubric);

            globalMockRubrics.push(newRubric);
            console.log('RubricService.createRubric: Total rubrics now:', globalMockRubrics.length);

            // Save to persistent storage
            await this.saveToStorage();
            console.log('RubricService.createRubric: Saved to storage');

            this.clearCache(); // Clear cache after data change

            return {
                data: newRubric,
                success: true,
                message: 'Rubric created successfully'
            };
        } catch (error) {
            console.error('RubricService.createRubric: Error:', error);
            return {
                data: {} as RubricData,
                success: false,
                message: 'Failed to create rubric'
            };
        }
    }

    // Get rubrics with filtering
    async getRubrics(courseId?: string, assignmentId?: string): Promise<RubricListResponse> {
        console.log('=== getRubrics DEBUG ===');
        console.log('Service instance ID:', this.constructor.name, Date.now());

        // Ensure storage is initialized
        await this.initializeStorage();

        console.log('globalMockRubrics length:', globalMockRubrics.length);
        console.log('globalMockRubrics:', globalMockRubrics.map(r => ({ id: r.id, title: r.title, courseId: r.courseId })));
        console.log('Filter params:', { courseId, assignmentId });

        const cacheKey = this.getCacheKey('getRubrics', [courseId, assignmentId]);
        console.log('Cache key:', cacheKey);
        const cached = this.getFromCache<RubricListResponse>(cacheKey);
        console.log('Cached result:', cached ? `${cached.data.length} items` : 'none');

        if (cached) {
            console.log('Returning cached result with', cached.data.length, 'items');
            return cached;
        }

        await this.simulateApiDelay();

        try {
            let filteredRubrics = [...globalMockRubrics];
            console.log('filteredRubrics initial length:', filteredRubrics.length);

            if (courseId) {
                console.log('Filtering by courseId:', courseId);
                filteredRubrics = filteredRubrics.filter(r => r.courseId === courseId);
                console.log('After courseId filter:', filteredRubrics.length);
            }

            if (assignmentId) {
                console.log('Filtering by assignmentId:', assignmentId);
                filteredRubrics = filteredRubrics.filter(r => r.assignmentId === assignmentId);
                console.log('After assignmentId filter:', filteredRubrics.length);
            }

            const result: RubricListResponse = {
                data: filteredRubrics,
                total: filteredRubrics.length,
                page: 1,
                limit: filteredRubrics.length,
                filters: {
                    courseId,
                    assignmentId
                }
            };

            console.log('Final result:', result.data.length, 'items');
            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            return {
                data: [],
                total: 0,
                page: 1,
                limit: 0,
                message: 'Failed to retrieve rubrics'
            };
        }
    }

    // Get single rubric by ID
    async getRubricById(id: string): Promise<ApiResponse<RubricData | null>> {
        await this.simulateApiDelay();

        const rubric = globalMockRubrics.find(r => r.id === id);

        return {
            data: rubric || null,
            success: !!rubric,
            message: rubric ? 'Rubric found' : 'Rubric not found'
        };
    }

    // Update rubric
    async updateRubric(id: string, updates: Partial<RubricData>): Promise<ApiResponse<RubricData>> {
        await this.simulateApiDelay();

        try {
            console.log('RubricService.updateRubric: Updating rubric', id, 'with data:', updates);

            const rubricIndex = globalMockRubrics.findIndex((r: RubricData) => r.id === id);
            if (rubricIndex === -1) {
                console.error('RubricService.updateRubric: Rubric not found:', id);
                return {
                    data: {} as RubricData,
                    success: false,
                    message: 'Rubric not found'
                };
            }

            const validation = this.validateRubric({ ...globalMockRubrics[rubricIndex], ...updates });
            if (!validation.isValid) {
                console.error('RubricService.updateRubric: Validation failed:', validation.errors);
                return {
                    data: {} as RubricData,
                    success: false,
                    message: `Validation failed: ${validation.errors.join(', ')}`
                };
            }

            const updatedRubric = {
                ...globalMockRubrics[rubricIndex],
                ...updates,
                updatedAt: new Date()
            };

            // Recalculate total points if questions were updated
            if (updates.questions) {
                updatedRubric.totalMinPoints = updates.questions.reduce((sum, q) => sum + q.minScore, 0);
                updatedRubric.totalMaxPoints = updates.questions.reduce((sum, q) => sum + q.maxScore, 0);
            }

            console.log('RubricService.updateRubric: Updated rubric:', updatedRubric);

            globalMockRubrics[rubricIndex] = updatedRubric;
            console.log('RubricService.updateRubric: Total rubrics now:', globalMockRubrics.length);

            // Debug: confirm lectureNotes are present before persisting
            console.log('RubricService.updateRubric: lectureNotes.length before saveToStorage:', updatedRubric.lectureNotes?.length ?? 0);

            // Save to persistent storage
            await this.saveToStorage();
            console.log('RubricService.updateRubric: Saved to storage');

            this.clearCache(); // Clear cache after data change

            return {
                data: updatedRubric,
                success: true,
                message: 'Rubric updated successfully'
            };
        } catch (error) {
            console.error('RubricService.updateRubric: Error:', error);
            return {
                data: {} as RubricData,
                success: false,
                message: 'Failed to update rubric'
            };
        }
    }

    // Delete rubric
    async deleteRubric(id: string): Promise<ApiResponse<boolean>> {
        await this.simulateApiDelay();

        try {
            const rubricIndex = globalMockRubrics.findIndex((r: RubricData) => r.id === id);
            if (rubricIndex === -1) {
                return {
                    data: false,
                    success: false,
                    message: 'Rubric not found'
                };
            }

            // Delete associated lecture notes from backend before removing rubric
            const rubric = globalMockRubrics[rubricIndex];
            if (rubric.lectureNotes && rubric.lectureNotes.length > 0) {
                for (const note of rubric.lectureNotes) {
                    const backendId = note.backendId || note.id;
                    try {
                        await fetch(`http://localhost:5000/api/lecture-notes/${backendId}`, {
                            method: 'DELETE',
                            signal: AbortSignal.timeout(5000)
                        });
                        console.log(`Deleted lecture note ${backendId} from backend`);
                    } catch (e) {
                        console.warn(`Failed to delete lecture note ${backendId} from backend:`, e);
                    }
                }
            }

            globalMockRubrics.splice(rubricIndex, 1);

            // Save to persistent storage
            await this.saveToStorage();

            this.clearCache(); // Clear cache after data change

            return {
                data: true,
                success: true,
                message: 'Rubric deleted successfully'
            };
        } catch (error) {
            return {
                data: false,
                success: false,
                message: 'Failed to delete rubric'
            };
        }
    }

    // Assign rubric to assignment
    async assignRubricToAssignment(rubricId: string, assignmentId: string): Promise<ApiResponse<boolean>> {
        await this.simulateApiDelay();

        try {
            const rubricIndex = globalMockRubrics.findIndex((r: RubricData) => r.id === rubricId);
            if (rubricIndex === -1) {
                return {
                    data: false,
                    success: false,
                    message: 'Rubric not found'
                };
            }

            globalMockRubrics[rubricIndex].assignmentId = assignmentId;
            globalMockRubrics[rubricIndex].updatedAt = new Date();

            // Update assignment to reference this rubric
            const assignmentIndex = mockAssignments.findIndex(a => a.id === assignmentId);
            if (assignmentIndex !== -1) {
                mockAssignments[assignmentIndex].rubricId = rubricId;
            }

            // Save to persistent storage
            await this.saveToStorage();

            this.clearCache(); // Clear cache after data change

            return {
                data: true,
                success: true,
                message: 'Rubric assigned to assignment successfully'
            };
        } catch (error) {
            return {
                data: false,
                success: false,
                message: 'Failed to assign rubric to assignment'
            };
        }
    }

    // Get courses (for dropdown/selection)
    async getCourses(): Promise<ApiResponse<Course[]>> {
        await this.simulateApiDelay();

        return {
            data: mockCourses,
            success: true,
            message: 'Courses retrieved successfully'
        };
    }

    // Get assignments for a course
    async getAssignments(courseId?: string): Promise<ApiResponse<Assignment[]>> {
        await this.simulateApiDelay();

        let filteredAssignments = [...mockAssignments];
        if (courseId) {
            filteredAssignments = filteredAssignments.filter(a => a.courseId === courseId);
        }

        return {
            data: filteredAssignments,
            success: true,
            message: 'Assignments retrieved successfully'
        };
    }
}