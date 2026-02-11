import { GradingSession, UserEditedScores } from '../types';

export class GradingSessionModel {
  private session: GradingSession;
  private userEditedScores: UserEditedScores = {};

  constructor(session: GradingSession) {
    this.session = session;
  }

  // Get current session
  getSession(): GradingSession {
    return { ...this.session };
  }

  // Update current student index
  setCurrentStudentIndex(index: number): void {
    this.session.currentStudentIndex = Math.max(0, Math.min(index, this.session.studentIds.length - 1));
  }

  // Get current student index
  getCurrentStudentIndex(): number {
    return this.session.currentStudentIndex;
  }

  // Navigate to next student
  nextStudent(): boolean {
    if (this.session.currentStudentIndex < this.session.studentIds.length - 1) {
      this.session.currentStudentIndex++;
      return true;
    }
    return false;
  }

  // Navigate to previous student
  previousStudent(): boolean {
    if (this.session.currentStudentIndex > 0) {
      this.session.currentStudentIndex--;
      return true;
    }
    return false;
  }

  // Update last saved time
  updateLastSaved(): void {
    this.session.lastSaved = new Date();
  }

  // Set auto-saving status
  setAutoSaving(isAutoSaving: boolean): void {
    this.session.isAutoSaving = isAutoSaving;
  }

  // Check if auto-saving
  isAutoSaving(): boolean {
    return this.session.isAutoSaving;
  }

  // Get last saved time
  getLastSaved(): Date {
    return this.session.lastSaved;
  }

  // Track user edited scores
  markScoreAsEdited(studentIndex: number, rubricId: string): void {
    const key = `${studentIndex}-${rubricId}`;
    this.userEditedScores[key] = true;
  }

  // Check if score has been edited by user
  hasUserEditedScore(studentIndex: number, rubricId: string): boolean {
    const key = `${studentIndex}-${rubricId}`;
    return this.userEditedScores[key] || false;
  }

  // Get all user edited scores
  getUserEditedScores(): UserEditedScores {
    return { ...this.userEditedScores };
  }

  // Reset user edited scores
  resetUserEditedScores(): void {
    this.userEditedScores = {};
  }

  // Get total number of students in session
  getTotalStudents(): number {
    return this.session.studentIds.length;
  }

  // Get current student ID
  getCurrentStudentId(): string | undefined {
    return this.session.studentIds[this.session.currentStudentIndex];
  }
}
