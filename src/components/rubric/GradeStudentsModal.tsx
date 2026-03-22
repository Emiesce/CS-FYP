import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { RubricData } from '../../types';

const GRADING_API = 'http://localhost:5000';

interface StudentEntry {
    id: string;
    studentId: string;
    studentName: string;
    answer: string;
}

interface GradeStudentsModalProps {
    rubric: RubricData;
    onClose: () => void;
}

type GradingStatus = 'idle' | 'grading' | 'done' | 'error';

interface GradingResult {
    studentId: string;
    studentName: string;
    status: 'success' | 'error';
    totalScore?: number;
    maxScore?: number;
    error?: string;
}

export function GradeStudentsModal({ rubric, onClose }: GradeStudentsModalProps) {
    const [students, setStudents] = useState<StudentEntry[]>([
        { id: '1', studentId: '', studentName: '', answer: '' }
    ]);
    const [status, setStatus] = useState<GradingStatus>('idle');
    const [results, setResults] = useState<GradingResult[]>([]);
    const [currentlyGrading, setCurrentlyGrading] = useState('');

    const addStudent = () => {
        setStudents(prev => [
            ...prev,
            { id: Date.now().toString(), studentId: '', studentName: '', answer: '' }
        ]);
    };

    const removeStudent = (id: string) => {
        setStudents(prev => prev.filter(s => s.id !== id));
    };

    const updateStudent = (id: string, field: keyof StudentEntry, value: string) => {
        setStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleGrade = async () => {
        const valid = students.filter(s => s.studentId.trim() && s.answer.trim());
        if (valid.length === 0) return;

        setStatus('grading');
        setResults([]);
        const gradingResults: GradingResult[] = [];

        for (const student of valid) {
            setCurrentlyGrading(student.studentName || student.studentId);

            try {
                const response = await fetch(`${GRADING_API}/grade-answer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: student.studentId.trim(),
                        student_name: student.studentName.trim() || student.studentId.trim(),
                        answer: student.answer.trim(),
                        marking_scheme_id: rubric.id,
                        assignment_id: rubric.assignmentId || rubric.id,
                        course_id: rubric.courseId || 'default'
                    })
                });

                const data = await response.json();

                if (response.ok && data.success !== false) {
                    const summary = data.data?.summary || data.summary;
                    gradingResults.push({
                        studentId: student.studentId,
                        studentName: student.studentName || student.studentId,
                        status: 'success',
                        totalScore: summary?.totalScore ?? data.data?.total_score,
                        maxScore: summary?.maxScore ?? data.data?.max_total_score
                    });
                } else {
                    gradingResults.push({
                        studentId: student.studentId,
                        studentName: student.studentName || student.studentId,
                        status: 'error',
                        error: data.error || 'Grading failed'
                    });
                }
            } catch (e) {
                gradingResults.push({
                    studentId: student.studentId,
                    studentName: student.studentName || student.studentId,
                    status: 'error',
                    error: 'Could not connect to grading API. Is it running on port 5000?'
                });
            }

            setResults([...gradingResults]);
        }

        setCurrentlyGrading('');
        setStatus('done');
    };

    const validCount = students.filter(s => s.studentId.trim() && s.answer.trim()).length;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Grade Students</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Rubric: {rubric.title}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="size-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {status === 'idle' || status === 'grading' ? (
                        <>
                            <p className="text-sm text-gray-600">
                                Enter student IDs and their answers. The AI will grade each answer using the rubric
                                and any associated lecture notes as context.
                            </p>

                            {students.map((student, index) => (
                                <div key={student.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-700">
                                            Student {index + 1}
                                        </span>
                                        {students.length > 1 && (
                                            <button
                                                onClick={() => removeStudent(student.id)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">
                                                Student ID *
                                            </label>
                                            <input
                                                type="text"
                                                value={student.studentId}
                                                onChange={e => updateStudent(student.id, 'studentId', e.target.value)}
                                                placeholder="e.g. 20841234"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                disabled={status === 'grading'}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 mb-1 block">
                                                Student Name (optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={student.studentName}
                                                onChange={e => updateStudent(student.id, 'studentName', e.target.value)}
                                                placeholder="e.g. John Smith"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                disabled={status === 'grading'}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-gray-500 mb-1 block">
                                            Student Answer *
                                        </label>
                                        <textarea
                                            value={student.answer}
                                            onChange={e => updateStudent(student.id, 'answer', e.target.value)}
                                            placeholder="Paste the student's answer here..."
                                            rows={5}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                            disabled={status === 'grading'}
                                        />
                                    </div>
                                </div>
                            ))}

                            {status === 'idle' && (
                                <button
                                    onClick={addStudent}
                                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="size-4" />
                                    Add another student
                                </button>
                            )}

                            {status === 'grading' && currentlyGrading && (
                                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                                    <Loader2 className="size-5 text-blue-600 animate-spin" />
                                    <div>
                                        <p className="text-sm font-medium text-blue-900">
                                            Grading {currentlyGrading}...
                                        </p>
                                        <p className="text-xs text-blue-600">
                                            Running RAG retrieval + Azure OpenAI grading
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Partial results while grading */}
                            {results.length > 0 && (
                                <div className="space-y-2">
                                    {results.map(r => (
                                        <ResultRow key={r.studentId} result={r} />
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        /* Final results */
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                                <CheckCircle className="size-5" />
                                <span className="text-sm font-medium">
                                    Grading complete — results saved to grading storage
                                </span>
                            </div>

                            {results.map(r => (
                                <ResultRow key={r.studentId} result={r} />
                            ))}

                            <p className="text-xs text-gray-500 mt-2">
                                Results are stored in the grading system and can be viewed on the Grading page.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-xl">
                    <Button variant="outline" onClick={onClose}>
                        {status === 'done' ? 'Close' : 'Cancel'}
                    </Button>

                    {status !== 'done' && (
                        <Button
                            onClick={handleGrade}
                            disabled={status === 'grading' || validCount === 0}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                        >
                            {status === 'grading' ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Grading {results.length}/{validCount}...
                                </>
                            ) : (
                                <>Grade {validCount} student{validCount !== 1 ? 's' : ''}</>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function ResultRow({ result }: { result: GradingResult }) {
    const percentage = result.totalScore != null && result.maxScore
        ? Math.round((result.totalScore / result.maxScore) * 100)
        : null;

    const color = percentage == null ? 'gray'
        : percentage >= 80 ? 'green'
            : percentage >= 60 ? 'yellow'
                : 'red';

    const colorClasses = {
        green: 'bg-green-50 border-green-200 text-green-800',
        yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        red: 'bg-red-50 border-red-200 text-red-800',
        gray: 'bg-gray-50 border-gray-200 text-gray-800'
    };

    return (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${colorClasses[color]}`}>
            <div className="flex items-center gap-2">
                {result.status === 'success' ? (
                    <CheckCircle className="size-4" />
                ) : (
                    <AlertCircle className="size-4 text-red-500" />
                )}
                <div>
                    <span className="text-sm font-medium">{result.studentName}</span>
                    <span className="text-xs ml-2 opacity-70">({result.studentId})</span>
                </div>
            </div>

            {result.status === 'success' && result.totalScore != null ? (
                <div className="text-right">
                    <span className="text-sm font-semibold">
                        {result.totalScore.toFixed(1)} / {result.maxScore}
                    </span>
                    {percentage != null && (
                        <span className="text-xs ml-2 opacity-70">{percentage}%</span>
                    )}
                </div>
            ) : (
                <span className="text-xs text-red-600">{result.error}</span>
            )}
        </div>
    );
}
