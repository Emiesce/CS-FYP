// Utility for managing file storage
// All operations go through grading_api.py (port 5000)
// which handles file storage + text extraction + RAG indexing

const GRADING_API = 'http://localhost:5000';

export class FileStorageService {
    private static readonly STORAGE_PREFIX = 'lecture-note-file-';
    private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

    /**
     * Upload a file through the full pipeline:
     * grading_api.py stores file + extracts text + indexes into ChromaDB for RAG
     */
    static async storeFile(noteId: string, file: File, rubricId?: string): Promise<string | null> {
        if (file.size > this.MAX_FILE_SIZE) {
            console.warn(`File ${file.name} exceeds maximum size of 50MB`);
            return null;
        }

        // Try grading API (full pipeline: store + extract + RAG index)
        try {
            const formData = new FormData();
            formData.append('file', file);
            if (rubricId) formData.append('associate_with_rubric', rubricId);

            const response = await fetch(`${GRADING_API}/api/lecture-notes/upload`, {
                method: 'POST',
                body: formData,
                signal: AbortSignal.timeout(30000)
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data?.id) {
                    localStorage.setItem(`${this.STORAGE_PREFIX}id-map-${noteId}`, result.data.id);
                    console.log(`[FileStorage] Uploaded + RAG indexed: ${file.name}`);
                    // Also save base64 to localStorage so file survives page refresh
                    try {
                        const fileContent = await this.readFileAsBase64(file);
                        localStorage.setItem(this.getStorageKey(noteId), fileContent);
                    } catch (_) { /* non-critical */ }
                    return result.data.id; // Return backend UUID
                }
            }
        } catch (e) {
            console.warn('[FileStorage] Grading API unavailable, falling back to localStorage');
        }

        // Fallback: localStorage (no RAG)
        try {
            const fileContent = await this.readFileAsBase64(file);
            localStorage.setItem(this.getStorageKey(noteId), fileContent);
            console.log(`[FileStorage] Stored in localStorage (no RAG): ${file.name}`);
            return null; // No backend ID, file is in localStorage
        } catch (e) {
            console.error('[FileStorage] All storage methods failed:', e);
            return null;
        }
    }

    static async getFile(noteId: string): Promise<string | null> {
        const backendId = localStorage.getItem(`${this.STORAGE_PREFIX}id-map-${noteId}`) || noteId;
        try {
            const res = await fetch(`${GRADING_API}/api/lecture-notes/download/${backendId}`, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
            if (res.ok) return `${GRADING_API}/api/lecture-notes/download/${backendId}`;
        } catch (_) { /* fall through */ }
        return localStorage.getItem(this.getStorageKey(noteId));
    }

    static getFileSync(noteId: string): string | null {
        return localStorage.getItem(this.getStorageKey(noteId));
    }

    static async getDownloadUrl(noteId: string): Promise<string | null> {
        const backendId = localStorage.getItem(`${this.STORAGE_PREFIX}id-map-${noteId}`) || noteId;
        return `${GRADING_API}/api/lecture-notes/download/${backendId}`;
    }

    static async removeFile(noteId: string): Promise<void> {
        const backendId = localStorage.getItem(`${this.STORAGE_PREFIX}id-map-${noteId}`) || noteId;
        try {
            await fetch(`${GRADING_API}/api/lecture-notes/${backendId}`, {
                method: 'DELETE',
                signal: AbortSignal.timeout(5000)
            });
        } catch (_) { /* ignore */ }
        localStorage.removeItem(this.getStorageKey(noteId));
        localStorage.removeItem(`${this.STORAGE_PREFIX}id-map-${noteId}`);
    }

    static async hasFile(noteId: string): Promise<boolean> {
        // If we have a backend id-map entry, the file was stored on the backend
        if (localStorage.getItem(`${this.STORAGE_PREFIX}id-map-${noteId}`)) return true;
        // Otherwise check localStorage fallback
        return localStorage.getItem(this.getStorageKey(noteId)) !== null;
    }

    static hasFileSync(noteId: string): boolean {
        // If we have a backend id-map entry, the file was stored on the backend
        if (localStorage.getItem(`${this.STORAGE_PREFIX}id-map-${noteId}`)) return true;
        return localStorage.getItem(this.getStorageKey(noteId)) !== null;
    }

    private static getStorageKey(noteId: string): string {
        return `${this.STORAGE_PREFIX}${noteId}`;
    }

    private static readFileAsBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static getStorageUsage(): { count: number; totalSize: number } {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.STORAGE_PREFIX));
        const totalSize = keys.reduce((sum, k) => sum + (localStorage.getItem(k)?.length || 0), 0);
        return { count: keys.length, totalSize };
    }

    static setUseLocalStorage(_use: boolean): void {
        // No-op — kept for backward compatibility
    }
}
