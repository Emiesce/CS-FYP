import { Student, ApiResponse, PaginatedResponse } from '../types';

// Mock data for development - in production, this would connect to a real API
const mockStudents: Student[] = [
    {
        id: "1",
        studentNumber: "2084 1234",
        name: "John Smith",
        essay: `Several factors contribute to the planning fallacy. First, individuals often rely on their experience and intuition rather than empirical data. This reliance can lead to overconfidence in their abilities and an underestimation of unforeseen challenges. Second, the complexity of tasks can obscure the true time and cost involved. When planning a project, it is easy to overlook dependencies and interrelated tasks, leading to overly optimistic projections.

Additionally, social and organizational pressures can exacerbate the planning fallacy. Teams may feel compelled to present optimistic timelines to secure approval or funding, further distorting realistic expectations. This pressure can create a culture of unrealistic planning, where stakeholders are consistently caught off guard by delays and overspending.`,
        rubrics: [
            {
                id: "content1",
                title: "Content 1: Explain the concept of planning fallacy",
                description: "AI: The student answer elaborated on the idea of planning fallacy causes in [1]",
                score: 8,
                maxScore: 10,
                aiSuggestedScore: 7,
                highlightedText: "complexity of tasks can obscure the true time and cost"
            },
            {
                id: "content2",
                title: "Content 2: Explain psychological factors",
                description: "AI: The student answer demonstrated understanding of cognitive biases and overconfidence",
                score: 8,
                maxScore: 10,
                aiSuggestedScore: 8,
                highlightedText: "rely on their experience and intuition rather than empirical data"
            },
            {
                id: "organization",
                title: "Organization:",
                description: "Well-structured response with clear progression of ideas and smooth transitions",
                score: 8,
                maxScore: 10,
                aiSuggestedScore: 9
            }
        ]
    },
    {
        id: "2",
        studentNumber: "2084 5678",
        name: "Jane Doe",
        essay: `The planning fallacy is a cognitive bias where people underestimate the time, cost, and risks involved in future actions while overestimating their benefits. This phenomenon occurs because individuals tend to focus on best-case scenarios rather than considering potential obstacles and complications that may arise during project execution.

Research has shown that even experienced professionals fall victim to this bias. The optimism bias plays a significant role in planning fallacy, as people naturally tend to be overly optimistic about their capabilities and the likelihood of positive outcomes.`,
        rubrics: [
            {
                id: "content1",
                title: "Content 1: Explain the concept of planning fallacy",
                description: "AI: Clear definition provided with good understanding of the concept",
                score: 9,
                maxScore: 10,
                aiSuggestedScore: 9,
                highlightedText: "cognitive bias where people underestimate the time, cost, and risks"
            },
            {
                id: "content2",
                title: "Content 2: Explain psychological factors",
                description: "AI: Good explanation of psychological factors including optimism bias",
                score: 7,
                maxScore: 10,
                aiSuggestedScore: 8,
                highlightedText: "optimism bias plays a significant role"
            },
            {
                id: "organization",
                title: "Organization:",
                description: "Clear structure with logical flow, could benefit from more detailed examples",
                score: 8,
                maxScore: 10,
                aiSuggestedScore: 7
            }
        ]
    },
    {
        id: "3",
        studentNumber: "2084 9012",
        name: "Mike Johnson",
        essay: `Planning fallacy happens when we think things will take less time than they actually do. I think this is because people are too positive about their work and don't think about problems that might happen. Sometimes managers want quick results so they pressure teams to give unrealistic timelines.

For example, when I was working on a group project, we thought it would take 2 weeks but it took 4 weeks because we had technical issues and one team member got sick.`,
        rubrics: [
            {
                id: "content1",
                title: "Content 1: Explain the concept of planning fallacy",
                description: "AI: Basic understanding shown but lacks depth and precision",
                score: 6,
                maxScore: 10,
                aiSuggestedScore: 5,
                highlightedText: "think things will take less time than they actually do"
            },
            {
                id: "content2",
                title: "Content 2: Explain psychological factors",
                description: "AI: Limited explanation of psychological factors, mostly anecdotal",
                score: 5,
                maxScore: 10,
                aiSuggestedScore: 4,
                highlightedText: "people are too positive about their work"
            },
            {
                id: "organization",
                title: "Organization:",
                description: "Informal structure with personal example, needs more academic rigor",
                score: 6,
                maxScore: 10,
                aiSuggestedScore: 5
            }
        ]
    }
];

export class GradingService {
    private baseUrl: string;
    private cache: Map<string, any> = new Map();

    constructor(baseUrl: string = '/api') {
        this.baseUrl = baseUrl;
    }

    // Simulate API delay - reduced for better performance
    private async simulateApiDelay(ms: number = 50): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Cache management
    private getCacheKey(method: string, params: any[]): string {
        return `${method}-${JSON.stringify(params)}`;
    }

    private getFromCache<T>(key: string): T | null {
        return this.cache.get(key) || null;
    }

    private setCache<T>(key: string, data: T): void {
        this.cache.set(key, data);
    }

    // Get all students for a course/assignment - with caching
    async getStudents(courseId?: string, assignmentId?: string): Promise<ApiResponse<Student[]>> {
        const cacheKey = this.getCacheKey('getStudents', [courseId, assignmentId]);
        const cached = this.getFromCache<ApiResponse<Student[]>>(cacheKey);

        if (cached) {
            return cached;
        }

        await this.simulateApiDelay();

        try {
            // In production, this would be a real API call:
            // const response = await fetch(`${this.baseUrl}/students?courseId=${courseId}&assignmentId=${assignmentId}`);
            // const data = await response.json();

            const result = {
                data: mockStudents,
                success: true,
                message: 'Students retrieved successfully'
            };

            this.setCache(cacheKey, result);
            return result;
        } catch (error) {
            return {
                data: [],
                success: false,
                message: 'Failed to retrieve students'
            };
        }
    }

    // Get paginated students
    async getStudentsPaginated(page: number = 1, limit: number = 10, courseId?: string): Promise<PaginatedResponse<Student>> {
        await this.simulateApiDelay();

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedData = mockStudents.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            total: mockStudents.length,
            page,
            limit
        };
    }

    // Get single student by ID
    async getStudentById(id: string): Promise<ApiResponse<Student | null>> {
        await this.simulateApiDelay();

        const student = mockStudents.find(s => s.id === id);

        return {
            data: student || null,
            success: !!student,
            message: student ? 'Student found' : 'Student not found'
        };
    }

    // Update student rubric score
    async updateRubricScore(studentId: string, rubricId: string, score: number): Promise<ApiResponse<boolean>> {
        await this.simulateApiDelay();

        try {
            const student = mockStudents.find(s => s.id === studentId);
            if (student) {
                const rubric = student.rubrics.find(r => r.id === rubricId);
                if (rubric) {
                    rubric.score = Math.max(0, Math.min(score, rubric.maxScore));

                    // In production, this would be an API call:
                    // await fetch(`${this.baseUrl}/students/${studentId}/rubrics/${rubricId}`, {
                    //   method: 'PUT',
                    //   body: JSON.stringify({ score }),
                    //   headers: { 'Content-Type': 'application/json' }
                    // });

                    return {
                        data: true,
                        success: true,
                        message: 'Score updated successfully'
                    };
                }
            }

            return {
                data: false,
                success: false,
                message: 'Student or rubric not found'
            };
        } catch (error) {
            return {
                data: false,
                success: false,
                message: 'Failed to update score'
            };
        }
    }

    // Save all grades for a student
    async saveStudentGrades(studentId: string): Promise<ApiResponse<boolean>> {
        await this.simulateApiDelay();

        try {
            const student = mockStudents.find(s => s.id === studentId);
            if (!student) {
                return {
                    data: false,
                    success: false,
                    message: 'Student not found'
                };
            }

            // In production, this would be an API call:
            // await fetch(`${this.baseUrl}/students/${studentId}/grades`, {
            //   method: 'POST',
            //   body: JSON.stringify({ rubrics: student.rubrics }),
            //   headers: { 'Content-Type': 'application/json' }
            // });

            return {
                data: true,
                success: true,
                message: 'Grades saved successfully'
            };
        } catch (error) {
            return {
                data: false,
                success: false,
                message: 'Failed to save grades'
            };
        }
    }

    // Submit final grades
    async submitGrades(studentIds: string[]): Promise<ApiResponse<boolean>> {
        await this.simulateApiDelay(500); // Longer delay for submission

        try {
            // In production, this would be an API call:
            // await fetch(`${this.baseUrl}/grades/submit`, {
            //   method: 'POST',
            //   body: JSON.stringify({ studentIds }),
            //   headers: { 'Content-Type': 'application/json' }
            // });

            return {
                data: true,
                success: true,
                message: 'Grades submitted successfully'
            };
        } catch (error) {
            return {
                data: false,
                success: false,
                message: 'Failed to submit grades'
            };
        }
    }
}