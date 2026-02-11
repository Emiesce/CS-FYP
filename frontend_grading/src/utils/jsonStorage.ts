import { RubricData } from '../types';

const RUBRICS_FILE_PATH = '/src/data/rubrics.json';

export class JsonStorageService {
    // Read rubrics from JSON file
    static async loadRubrics(): Promise<RubricData[]> {
        try {
            const response = await fetch(RUBRICS_FILE_PATH);
            if (!response.ok) {
                console.warn('Could not load rubrics file, using empty array');
                return [];
            }
            const data = await response.json();

            // Convert date strings back to Date objects
            return data.map((rubric: any) => ({
                ...rubric,
                createdAt: new Date(rubric.createdAt),
                updatedAt: new Date(rubric.updatedAt)
            }));
        } catch (error) {
            console.error('Error loading rubrics:', error);
            return [];
        }
    }

    // Save rubrics to JSON file (Note: This won't work in browser environment)
    // In a real application, this would be handled by a backend API
    static async saveRubrics(rubrics: RubricData[]): Promise<boolean> {
        try {
            console.log('JsonStorageService.saveRubrics: Saving', rubrics.length, 'rubrics');

            // Convert Date objects to strings for JSON serialization
            const serializedRubrics = rubrics.map(rubric => ({
                ...rubric,
                createdAt: rubric.createdAt.toISOString(),
                updatedAt: rubric.updatedAt.toISOString()
            }));

            // Try to save to the actual JSON file via Python backend
            try {
                console.log('JsonStorageService.saveRubrics: Attempting to save to JSON file via backend...');
                const response = await fetch('http://localhost:5000/rubrics', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(serializedRubrics)
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    console.log('JsonStorageService.saveRubrics: Successfully saved to JSON file via backend');
                    console.log('JsonStorageService.saveRubrics: Backend response:', result);
                } else {
                    console.warn('JsonStorageService.saveRubrics: Backend save failed:', result);
                }
            } catch (backendError) {
                console.warn('JsonStorageService.saveRubrics: Backend not available, using localStorage only:', backendError);
            }

            // Always save to localStorage as fallback
            localStorage.setItem('rubrics', JSON.stringify(serializedRubrics));
            console.log('JsonStorageService.saveRubrics: Rubrics saved to localStorage');
            console.log('JsonStorageService.saveRubrics: Saved data:', serializedRubrics);
            return true;
        } catch (error) {
            console.error('JsonStorageService.saveRubrics: Error saving rubrics:', error);
            return false;
        }
    }

    // Load from localStorage (fallback for browser environment)
    static loadFromLocalStorage(): RubricData[] {
        try {
            const stored = localStorage.getItem('rubrics');
            if (!stored) return [];

            const data = JSON.parse(stored);
            return data.map((rubric: any) => ({
                ...rubric,
                createdAt: new Date(rubric.createdAt),
                updatedAt: new Date(rubric.updatedAt)
            }));
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return [];
        }
    }

    // Initialize storage with default data if empty
    static async initializeStorage(): Promise<RubricData[]> {
        try {
            // Try to load from localStorage first
            let rubrics = this.loadFromLocalStorage();

            // If localStorage is empty, try to load from JSON file
            if (rubrics.length === 0) {
                rubrics = await this.loadRubrics();

                // Save to localStorage for future use
                if (rubrics.length > 0) {
                    await this.saveRubrics(rubrics);
                }
            }

            return rubrics;
        } catch (error) {
            console.error('Error initializing storage:', error);
            return [];
        }
    }
}