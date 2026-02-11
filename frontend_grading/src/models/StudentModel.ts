import { Student, RubricCriteria } from '../types';

export class StudentModel {
  private students: Student[] = [];

  constructor(initialData: Student[] = []) {
    this.students = initialData;
  }

  // Get all students
  getAllStudents(): Student[] {
    return [...this.students];
  }

  // Get student by ID
  getStudentById(id: string): Student | undefined {
    return this.students.find(student => student.id === id);
  }

  // Get student by index
  getStudentByIndex(index: number): Student | undefined {
    return this.students[index];
  }

  // Get total number of students
  getTotalStudents(): number {
    return this.students.length;
  }

  // Update student essay
  updateStudentEssay(studentId: string, essay: string): boolean {
    const student = this.getStudentById(studentId);
    if (student) {
      student.essay = essay;
      return true;
    }
    return false;
  }

  // Update rubric score for a student
  updateRubricScore(studentId: string, rubricId: string, score: number): boolean {
    const student = this.getStudentById(studentId);
    if (student) {
      const rubric = student.rubrics.find(r => r.id === rubricId);
      if (rubric) {
        rubric.score = Math.max(0, Math.min(score, rubric.maxScore));
        return true;
      }
    }
    return false;
  }

  // Get total score for a student
  getStudentTotalScore(studentId: string): { current: number; maximum: number } {
    const student = this.getStudentById(studentId);
    if (!student) {
      return { current: 0, maximum: 0 };
    }

    return {
      current: student.rubrics.reduce((sum, rubric) => sum + rubric.score, 0),
      maximum: student.rubrics.reduce((sum, rubric) => sum + rubric.maxScore, 0)
    };
  }

  // Add a new student
  addStudent(student: Student): void {
    this.students.push(student);
  }

  // Remove a student
  removeStudent(studentId: string): boolean {
    const index = this.students.findIndex(s => s.id === studentId);
    if (index !== -1) {
      this.students.splice(index, 1);
      return true;
    }
    return false;
  }

  // Get rubric by student and rubric ID
  getRubric(studentId: string, rubricId: string): RubricCriteria | undefined {
    const student = this.getStudentById(studentId);
    return student?.rubrics.find(r => r.id === rubricId);
  }
}
