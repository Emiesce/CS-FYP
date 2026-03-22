import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2, CheckCircle, AlertCircle, Play, ChevronDown, ChevronUp, BookOpen, ServerOff } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { RubricData } from '../types';
import { JsonStorageService } from '../utils/jsonStorage';

const GRADING_API = 'http://localhost:5000';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentAnswer {
    questionId: string;
    answerText: string;
}

interface StudentSubmission {
    studentId: string;
    studentName: string;
    answers: StudentAnswer[];
}

interface GradingResult {
    studentId: string;
    studentName: string;
    status: 'pending' | 'grading' | 'done' | 'error';
    totalScore?: number;
    maxScore?: number;
    percentage?: number;
    error?: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const loadMockData = async (): Promise<StudentSubmission[]> => {
    const res = await fetch('/src/data/mock_student_answers.json');
    if (!res.ok) throw new Error('Failed to load mock data');
    return res.json();
};

// ─── Component ────────────────────────────────────────────────────────────────

export function StudentAnswersPage() {
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Backend status
    const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

    // Rubric selection
    const [rubrics, setRubrics] = useState<RubricData[]>([]);
    const [selectedRubricId, setSelectedRubricId] = useState('');

    // Submissions state
    const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState('');

    // Grading state
    const [gradingResults, setGradingResults] = useState<GradingResult[]>([]);
    const [isGrading, setIsGrading] = useState(false);
    const [gradingDone, setGradingDone] = useState(false);

    useEffect(() => {
        JsonStorageService.initializeStorage().then(setRubrics);
        checkBackend();
    }, []);

    const checkBackend = async () => {
        try {
            const res = await fetch(`${GRADING_API}/health`, { signal: AbortSignal.timeout(3000) });
            setBackendOnline(res.ok);
        } catch {
            setBackendOnline(false);
        }
    };

    // ── File upload ──────────────────────────────────────────────────────────

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError('');

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target?.result as string);
                const data: StudentSubmission[] = Array.isArray(parsed) ? parsed : [parsed];
                validateAndSet(data);
            } catch {
                setUploadError('Invalid JSON file. Please check the format.');
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be re-uploaded
        e.target.value = '';
    };

    const validateAndSet = (data: StudentSubmission[]) => {
        for (const s of data) {
            if (!s.studentId || !Array.isArray(s.answers)) {
                setUploadError('Each entry must have studentId and answers array.');
                return;
            }
        }
        setSubmissions(data);
        setGradingResults([]);
        setGradingDone(false);
    };

    const loadMock = async () => {
        try {
            const data = await loadMockData();
            validateAndSet(data);
        } catch {
            // Fallback: inline mock data
            const inline: StudentSubmission[] = [
                {
                    studentId: '20841234',
                    studentName: 'John Smith',
                    answers: [
                        { questionId: 'q1', answerText: 'The planning fallacy is a cognitive bias where individuals underestimate the time, costs, and risks of future actions while overestimating the benefits. First identified by Kahneman and Tversky in 1979, it stems from optimism bias and the inside view problem where people focus on the specific plan rather than base rates from past experience.' },
                        { questionId: 'q2', answerText: 'Psychological factors include optimism bias, the focusing illusion, anchoring bias, and motivated reasoning. People unconsciously favor information supporting their desired timeline and recall successful completions more easily than failures.' }
                    ]
                },
                {
                    studentId: '20841235',
                    studentName: 'Jane Doe',
                    answers: [
                        { questionId: 'q1', answerText: 'Planning fallacy refers to the tendency to underestimate how long a task will take. People are overly optimistic and do not consider past experiences. The concept was introduced by Kahneman and Tversky.' },
                        { questionId: 'q2', answerText: 'The psychological factors include optimism bias and the inside view problem. Social pressure from supervisors can also cause people to give overly optimistic estimates.' }
                    ]
                },
                {
                    studentId: '20841236',
                    studentName: 'Bob Johnson',
                    answers: [
                        { questionId: 'q1', answerText: 'Planning fallacy is when you think something will take less time than it actually does. The reason is that people are too optimistic.' },
                        { questionId: 'q2', answerText: 'People are optimistic and do not think about problems that might happen.' }
                    ]
                }
            ];
            validateAndSet(inline);
        }
    };

    // ── Grading ──────────────────────────────────────────────────────────────

    const handleGrade = async () => {
        if (!selectedRubricId || submissions.length === 0) return;

        setIsGrading(true);
        setGradingDone(false);

        // Initialise all as pending
        const initial: GradingResult[] = submissions.map(s => ({
            studentId: s.studentId,
            studentName: s.studentName || s.studentId,
            status: 'pending'
        }));
        setGradingResults(initial);

        const results = [...initial];

        for (let i = 0; i < submissions.length; i++) {
            const s = submissions[i];

            // Mark as grading
            results[i] = { ...results[i], status: 'grading' };
            setGradingResults([...results]);

            // Combine all answers into one text block
            const combinedAnswer = s.answers
                .map(a => `[Question ${a.questionId}]\n${a.answerText}`)
                .join('\n\n');

            try {
                const response = await fetch(`${GRADING_API}/grade-answer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: s.studentId,
                        student_name: s.studentName || s.studentId,
                        answer: combinedAnswer,
                        marking_scheme_id: selectedRubricId,
                        assignment_id: selectedRubricId,
                        course_id: 'default'
                    })
                });

                const data = await response.json();

                if (response.ok && data.success !== false) {
                    const summary = data.data?.summary || data.summary;
                    const totalScore = summary?.totalScore ?? data.data?.total_score ?? 0;
                    const maxScore = summary?.maxScore ?? data.data?.max_total_score ?? 0;
                    results[i] = {
                        ...results[i],
                        status: 'done',
                        totalScore,
                        maxScore,
                        percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
                    };
                } else {
                    results[i] = {
                        ...results[i],
                        status: 'error',
                        error: data.error || 'Grading failed'
                    };
                }
            } catch {
                results[i] = {
                    ...results[i],
                    status: 'error',
                    error: 'Cannot connect to grading API (port 5000)'
                };
            }

            setGradingResults([...results]);
        }

        setIsGrading(false);
        setGradingDone(true);
    };

    // ── Helpers ──────────────────────────────────────────────────────────────

    const selectedRubric = rubrics.find(r => r.id === selectedRubricId);
    const canGrade = selectedRubricId && submissions.length > 0 && !isGrading && backendOnline === true;

    const scoreColor = (pct?: number) => {
        if (pct == null) return 'bg-gray-100 text-gray-700';
        if (pct >= 80) return 'bg-green-100 text-green-800';
        if (pct >= 60) return 'bg-yellow-100 text-yellow-800';
        return 'bg-red-100 text-red-800';
    };

    const statusIcon = (status: GradingResult['status']) => {
        if (status === 'grading') return <Loader2 className="size-4 animate-spin text-blue-500" />;
        if (status === 'done') return <CheckCircle className="size-4 text-green-500" />;
        if (status === 'error') return <AlertCircle className="size-4 text-red-500" />;
        return <div className="size-4 rounded-full border-2 border-gray-300" />;
    };

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

            <div className="flex-1" style={{ padding: '2rem', paddingLeft: '3rem' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Student Answers</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Upload student answers and run AI grading against a rubric
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left column: setup */}
                    <div className="lg:col-span-1 space-y-4">

                        {/* Backend status banner */}
                        {backendOnline === false && (
                            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <ServerOff className="size-5 text-red-500 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium text-red-800">Grading API not running</p>
                                    <p className="text-xs text-red-600 mt-1">
                                        Start it with: <code className="bg-red-100 px-1 rounded">python grading_api.py</code>
                                    </p>
                                    <button onClick={checkBackend} className="text-xs text-red-700 underline mt-1 hover:no-underline">
                                        Retry connection
                                    </button>
                                </div>
                            </div>
                        )}
                        {backendOnline === true && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <CheckCircle className="size-4 text-green-500" />
                                <span className="text-xs text-green-700 font-medium">Grading API connected</span>
                            </div>
                        )}

                        <Card>
                            <CardContent className="p-5">
                                <h2 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                    <span className="size-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                                    Select Rubric
                                </h2>
                                <select
                                    value={selectedRubricId}
                                    onChange={e => setSelectedRubricId(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">— Choose a rubric —</option>
                                    {rubrics.map(r => (
                                        <option key={r.id} value={r.id}>{r.title}</option>
                                    ))}
                                </select>

                                {selectedRubric && (
                                    <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1">
                                        <div className="flex items-center gap-1">
                                            <BookOpen className="size-3" />
                                            <span className="font-medium">{selectedRubric.title}</span>
                                        </div>
                                        <div>{selectedRubric.questions.length} question{selectedRubric.questions.length !== 1 ? 's' : ''} · {selectedRubric.totalMaxPoints} pts max</div>
                                        {selectedRubric.lectureNotes && selectedRubric.lectureNotes.length > 0 && (
                                            <div className="text-green-700">✓ {selectedRubric.lectureNotes.length} lecture note{selectedRubric.lectureNotes.length !== 1 ? 's' : ''} attached</div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Step 2: Upload answers */}
                        <Card>
                            <CardContent className="p-5">
                                <h2 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                    <span className="size-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                                    Upload Answers
                                </h2>

                                {/* Upload zone */}
                                <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                                    <Upload className="size-6 text-gray-400" />
                                    <span className="text-sm text-gray-600">Upload JSON file</span>
                                    <span className="text-xs text-gray-400">or use mock data below</span>
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </label>

                                {uploadError && (
                                    <p className="mt-2 text-xs text-red-600">{uploadError}</p>
                                )}

                                <div className="mt-3 flex items-center gap-2">
                                    <div className="flex-1 h-px bg-gray-200" />
                                    <span className="text-xs text-gray-400">or</span>
                                    <div className="flex-1 h-px bg-gray-200" />
                                </div>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={loadMock}
                                    className="w-full mt-3 text-xs"
                                >
                                    Load mock data (3 students)
                                </Button>

                                {/* Format hint */}
                                <details className="mt-3">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                        Expected JSON format
                                    </summary>
                                    <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto text-gray-600">
                                        {`[
  {
    "studentId": "20841234",
    "studentName": "John Smith",
    "answers": [
      {
        "questionId": "q1",
        "answerText": "..."
      }
    ]
  }
]`}
                                    </pre>
                                </details>
                            </CardContent>
                        </Card>

                        {/* Step 3: Grade — moved to bottom bar */}
                    </div>
                    {/* Right column: submissions + results */}
                    <div className="lg:col-span-2 space-y-4">

                        {/* Submissions preview */}
                        {submissions.length > 0 && (
                            <Card>
                                <CardContent className="p-5">
                                    <h2 className="font-medium text-gray-900 mb-3">
                                        Loaded Submissions ({submissions.length})
                                    </h2>
                                    <div className="space-y-2">
                                        {submissions.map(s => {
                                            const result = gradingResults.find(r => r.studentId === s.studentId);
                                            const isExpanded = expandedStudent === s.studentId;

                                            return (
                                                <div key={s.studentId} className="border border-gray-200 rounded-lg overflow-hidden">
                                                    <button
                                                        onClick={() => setExpandedStudent(isExpanded ? null : s.studentId)}
                                                        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {result ? statusIcon(result.status) : <FileText className="size-4 text-gray-400" />}
                                                            <div className="text-left">
                                                                <span className="text-sm font-medium text-gray-900">
                                                                    {s.studentName || s.studentId}
                                                                </span>
                                                                <span className="text-xs text-gray-500 ml-2">
                                                                    {s.studentId}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-3">
                                                            {result?.status === 'done' && result.percentage != null && (
                                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(result.percentage)}`}>
                                                                    {result.totalScore?.toFixed(1)} / {result.maxScore} ({result.percentage}%)
                                                                </span>
                                                            )}
                                                            {result?.status === 'error' && (
                                                                <span className="text-xs text-red-600">Error</span>
                                                            )}
                                                            {result?.status === 'grading' && (
                                                                <span className="text-xs text-blue-600">Grading...</span>
                                                            )}
                                                            <span className="text-xs text-gray-400">
                                                                {s.answers.length} answer{s.answers.length !== 1 ? 's' : ''}
                                                            </span>
                                                            {isExpanded ? <ChevronUp className="size-4 text-gray-400" /> : <ChevronDown className="size-4 text-gray-400" />}
                                                        </div>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50">
                                                            {s.answers.map((a, idx) => (
                                                                <div key={a.questionId} className="text-sm">
                                                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                                        Q{idx + 1} ({a.questionId})
                                                                    </span>
                                                                    <p className="mt-1 text-gray-700 text-xs leading-relaxed line-clamp-4">
                                                                        {a.answerText}
                                                                    </p>
                                                                </div>
                                                            ))}

                                                            {result?.status === 'error' && (
                                                                <p className="text-xs text-red-600 bg-red-50 p-2 rounded">
                                                                    {result.error}
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Empty state */}
                        {submissions.length === 0 && (
                            <Card>
                                <CardContent className="p-12 text-center">
                                    <FileText className="size-12 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500 text-sm">No answers loaded yet</p>
                                    <p className="text-gray-400 text-xs mt-1">
                                        Upload a JSON file or load mock data to get started
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Run Grading button at the bottom */}
                        <div className="pt-2">
                            <button
                                onClick={handleGrade}
                                disabled={!canGrade}
                                style={{ backgroundColor: canGrade ? '#16a34a' : '#d1d5db', cursor: canGrade ? 'pointer' : 'not-allowed' }}
                                className="w-full py-4 text-base font-semibold text-white flex items-center justify-center gap-2 rounded-lg shadow transition-opacity hover:opacity-90"
                            >
                                {isGrading ? (
                                    <>
                                        <Loader2 className="size-5 animate-spin" />
                                        Grading {gradingResults.filter(r => r.status === 'done' || r.status === 'error').length}/{submissions.length}...
                                    </>
                                ) : (
                                    <>
                                        <Play className="size-5" />
                                        Run Grading
                                    </>
                                )}
                            </button>
                            {gradingDone && (
                                <p className="mt-2 text-sm text-green-700 text-center">
                                    ✓ Grading complete — results saved to storage
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
