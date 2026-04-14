import { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ChevronLeft, ChevronRight, Users, FileText, Menu, Eye, EyeOff } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';

const GRADING_API = 'http://localhost:5000';

// ─── Drag-to-resize divider ───────────────────────────────────────────────────

function usePanelResize(initialRightWidth: number) {
    const [rightWidth, setRightWidth] = useState(initialRightWidth);
    const dragging = useRef(false);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        dragging.current = true;
        const onMove = (ev: MouseEvent) => {
            if (!dragging.current) return;
            const containerRight = window.innerWidth;
            const newWidth = Math.max(280, Math.min(800, containerRight - ev.clientX));
            setRightWidth(newWidth);
        };
        const onUp = () => {
            dragging.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, []);

    return { rightWidth, onMouseDown };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GradeEntry {
    manualScore: number | null;
    aiSuggestedScore: number;
    highlightedText: string;
    aiJustification: string;
    aiSuggestion: string;
}

interface Criterion {
    criterionName: string;
    description: string;
    maxScore: number;
    grade: GradeEntry;
}

interface Question {
    questionNumber: number | string;
    questionText: string;
    studentAnswer: { answerText: string };
    criteria: Criterion[];
    questionTotalScore: number;
    questionMaxScore: number;
    questionPercentage: number;
}

interface Summary { totalScore: number; maxScore: number; percentage: number; grade: string; }

interface StudentResult {
    studentID: string;
    studentName: string;
    examId: string;
    examTitle: string;
    gradedAt: string;
    status: string;
    questions: Question[];
    summary: Summary;
}

interface GradingRecord {
    data: StudentResult;
    _metadata: { marking_scheme_id: string; assignment_id: string };
    id?: string;
}

// Flat rubric shape matching old GradingPage's rubric model
interface FlatRubric {
    id: string;
    title: string;
    description: string;
    score: number | null;  // null = not yet manually scored
    maxScore: number;
    aiSuggestedScore: number;
    highlightedText: string;
    justification: string;
    suggestion: string;
    questionIndex: number;
    criterionIndex: number;
}

function buildFlatRubrics(record: GradingRecord, manualScores: Record<string, number>): FlatRubric[] {
    return (record.data.questions || []).flatMap((q, qi) =>
        (q.criteria || []).map((c, ci) => {
            const key = `${qi}-${ci}`;
            // Only use a score if the human has explicitly set one (manualScore in record or local edit)
            const hasManual = key in manualScores || (c.grade.manualScore !== null && c.grade.manualScore !== undefined);
            const score = hasManual
                ? (manualScores[key] ?? c.grade.manualScore!)
                : null;
            return {
                id: key,
                title: c.criterionName || q.questionText || `Q${q.questionNumber} Criterion ${ci + 1}`,
                description: c.grade.aiJustification || c.description || '',
                score,
                maxScore: c.maxScore,
                aiSuggestedScore: c.grade.aiSuggestedScore,
                highlightedText: c.grade.highlightedText || '',
                justification: c.grade.aiJustification || '',
                suggestion: c.grade.aiSuggestion || '',
                questionIndex: qi,
                criterionIndex: ci,
            };
        })
    );
}

function buildEssayText(record: GradingRecord): string {
    return (record.data.questions || [])
        .map(q => {
            const header = q.questionText ? `[Q${q.questionNumber}: ${q.questionText}]\n` : '';
            return header + (q.studentAnswer?.answerText || '');
        })
        .join('\n\n');
}

// ─── StudentBadges (same as GradingPage) ─────────────────────────────────────

const StudentBadges = memo(({ rubrics }: { rubrics: FlatRubric[] }) => (
    <div className="flex items-center gap-2">
        {rubrics.map((r) => {
            if (r.score === null) {
                return <Badge key={r.id} className="bg-gray-100 text-gray-500">—/{r.maxScore}</Badge>;
            }
            const pct = (r.score / r.maxScore) * 100;
            const color = pct >= 80 ? 'bg-green-100 text-green-800' : pct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
            return <Badge key={r.id} className={color}>{r.score}/{r.maxScore}</Badge>;
        })}
    </div>
));

// ─── TotalScore (same as GradingPage) ────────────────────────────────────────

const TotalScore = memo(({ rubrics }: { rubrics: FlatRubric[] }) => {
    const scored = rubrics.filter(r => r.score !== null);
    const total = useMemo(() => ({
        current: scored.reduce((s, r) => s + (r.score as number), 0),
        maximum: rubrics.reduce((s, r) => s + r.maxScore, 0),
    }), [rubrics]);

    return (
        <div className="text-right">
            <div className="text-sm text-gray-400">Total</div>
            <div className="text-lg font-semibold">
                {scored.length === 0 ? '—' : total.current} / {total.maximum}
            </div>
        </div>
    );
});

// ─── RubricCard (same as GradingPage) ────────────────────────────────────────

const RubricCard = memo(({ rubric, isSelected, onSelect, onScoreUpdate, onTextUpdate, hasUserEdited }: {
    rubric: FlatRubric;
    isSelected: boolean;
    onSelect: () => void;
    onScoreUpdate: (score: number) => void;
    onTextUpdate: (field: 'justification' | 'suggestion', value: string) => void;
    hasUserEdited: boolean;
}) => {
    const justificationRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize justification textarea to fit content
    useEffect(() => {
        const el = justificationRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [rubric.justification]);

    return (
        <Card className={`p-6 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`} onClick={onSelect}>
            <h4 className="text-xl font-semibold text-[#2c2828] mb-2">{rubric.title}</h4>

            {/* AI justification — editable */}
            <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                <p className="text-xs font-medium text-gray-500 mb-1">Justification</p>
                <textarea
                    ref={justificationRef}
                    className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50 overflow-hidden"
                    value={rubric.justification}
                    onChange={(e) => {
                        onTextUpdate('justification', e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    placeholder="AI justification..."
                />
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">Score:</span>
                        <Input
                            type="number"
                            min="0"
                            max={rubric.maxScore}
                            step={0.5}
                            value={rubric.score ?? ''}
                            placeholder="—"
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val !== '') {
                                    const clamped = Math.min(rubric.maxScore, Math.max(0, parseFloat(val) || 0));
                                    onScoreUpdate(clamped);
                                }
                            }}
                            onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val)) {
                                    const clamped = Math.min(rubric.maxScore, Math.max(0, val));
                                    if (clamped !== val) onScoreUpdate(clamped);
                                }
                            }}
                            className={`w-16 text-center ${rubric.score !== null && (rubric.score > rubric.maxScore || rubric.score < 0) ? 'border-red-400' : ''}`}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-sm text-gray-600">/ {rubric.maxScore}</span>
                    </div>

                    {rubric.highlightedText && (
                        <Button
                            variant={isSelected ? 'default' : 'outline'}
                            size="sm"
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onSelect(); }}
                        >
                            {isSelected ? 'Hide' : 'Show'} Highlight
                        </Button>
                    )}
                </div>

                {/* AI suggested score */}
                {hasUserEdited && rubric.score !== null && (
                    <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                        <span className="text-sm font-medium text-blue-600">AI suggested:</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-blue-700">{rubric.aiSuggestedScore}</span>
                            <span className="text-sm text-gray-600">/ {rubric.maxScore}</span>
                            {rubric.aiSuggestedScore !== rubric.score && (
                                <Badge variant="outline" className={`text-xs ${rubric.score > rubric.aiSuggestedScore ? 'border-green-300 text-green-700' : 'border-orange-300 text-orange-700'}`}>
                                    {rubric.score > rubric.aiSuggestedScore ? '+' : ''}{(rubric.score - rubric.aiSuggestedScore).toFixed(1)}
                                </Badge>
                            )}
                        </div>
                    </div>
                )}

                {/* Suggestion — editable */}
                <div className="pt-2 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs font-medium text-blue-600 mb-1">Suggestion</p>
                    <textarea
                        className="w-full text-sm text-blue-800 border border-blue-100 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50"
                        rows={3}
                        value={rubric.suggestion}
                        onChange={(e) => onTextUpdate('suggestion', e.target.value)}
                        placeholder="Improvement suggestion..."
                    />
                </div>
            </div>
        </Card>
    );
});

// ─── Highlighted answer renderer ─────────────────────────────────────────────

function HighlightedAnswer({ text, highlight }: { text: string; highlight: string }) {
    if (!highlight || !text.includes(highlight)) {
        return <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">{text}</p>;
    }
    const parts = text.split(highlight);
    return (
        <p className="whitespace-pre-wrap text-gray-800 leading-relaxed">
            {parts.map((part, i) => (
                <React.Fragment key={i}>
                    {part}
                    {i < parts.length - 1 && (
                        <mark className="bg-blue-200 text-blue-800 px-0.5 rounded not-italic">{highlight}</mark>
                    )}
                </React.Fragment>
            ))}
        </p>
    );
}

// ─── Exam list card ───────────────────────────────────────────────────────────

function ExamCard({ examId, records, onSelect }: { examId: string; records: GradingRecord[]; onSelect: () => void }) {
    const scores = records.map(r => r.data.summary?.percentage ?? 0);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const title = records[0]?.data.examTitle || examId;
    const pctColor = avg >= 80 ? 'bg-green-100 text-green-800' : avg >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';

    return (
        <Card className="p-5 hover:shadow-md transition-all cursor-pointer border border-gray-200" onClick={onSelect}>
            <div className="flex items-start justify-between mb-3">
                <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
                </div>
                <span className={`text-sm font-bold px-2 py-1 rounded ${pctColor}`}>Avg {avg}%</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1"><Users className="size-4" />{records.length} student{records.length !== 1 ? 's' : ''}</span>
            </div>
        </Card>
    );
}

// ─── Student list ─────────────────────────────────────────────────────────────

function StudentList({ records, onSelect, onBack, onToggleSidebar, sidebarCollapsed }: { records: GradingRecord[]; onSelect: (i: number) => void; onBack: () => void; onToggleSidebar: () => void; sidebarCollapsed: boolean }) {
    const title = records[0]?.data.examTitle || '';
    return (
        <div className="bg-[#fafbff] min-h-screen">
            <div className="bg-[#cee5ff] p-4 shadow-sm flex items-center gap-3">
                {sidebarCollapsed && (
                    <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="flex items-center">
                        <Menu className="size-4" />
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-2">
                    <ChevronLeft className="size-4" /> Back
                </Button>
                <h2 className="text-xl font-medium">{title}</h2>
            </div>
            <div className="p-6 space-y-3">
                {records.map((r, i) => {
                    const s = r.data.summary;
                    const pct = s?.percentage ?? 0;
                    const pctColor = pct >= 80 ? 'bg-green-100 text-green-800' : pct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
                    return (
                        <Card key={r.id || i} className="p-4 hover:shadow-md cursor-pointer border border-gray-200" onClick={() => onSelect(i)}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                                        {r.data.studentName?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{r.data.studentName}</p>
                                        <p className="text-xs text-gray-500">{r.data.studentID}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-gray-800">{s?.totalScore} / {s?.maxScore}</span>
                                    <Badge className={pctColor}>{pct}%</Badge>
                                    <span className="text-sm font-bold text-gray-700">{s?.grade}</span>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Grading view — question-first navigation ────────────────────────────────
// Navigate: Question tabs across top, Student prev/next within each question

function GradingView({ records, initialIndex, onBack, onRecordsUpdate }: {
    records: GradingRecord[];
    initialIndex: number;
    onBack: () => void;
    onRecordsUpdate?: (updated: GradingRecord[]) => void;
}) {
    const [currentStudentIndex, setCurrentStudentIndex] = useState(initialIndex);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [selectedRubric, setSelectedRubric] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [localRecords, setLocalRecords] = useState(records);
    const [showStudentInfo, setShowStudentInfo] = useState(false);
    const { rightWidth, onMouseDown: onDividerMouseDown } = usePanelResize(535);

    // Per-student manual scores: { studentIndex: { "qi-ci": score } }
    const manualScoresRef = useRef<Record<number, Record<string, number>>>({});
    // Per-student text edits: { studentIndex: { "qi-ci-justification": text, "qi-ci-suggestion": text } }
    const textEditsRef = useRef<Record<number, Record<string, string>>>({});
    const [, forceUpdate] = useState(0);

    const record = localRecords[currentStudentIndex];
    const { data } = record;
    const totalQuestions = data.questions?.length ?? 0;
    const currentQuestion = data.questions?.[currentQuestionIndex];

    // Load saved manual scores for current student on mount / student change
    useEffect(() => {
        if (!manualScoresRef.current[currentStudentIndex]) {
            const initial: Record<string, number> = {};
            (localRecords[currentStudentIndex]?.data.questions || []).forEach((q, qi) => {
                (q.criteria || []).forEach((c, ci) => {
                    if (c.grade.manualScore !== null && c.grade.manualScore !== undefined) {
                        initial[`${qi}-${ci}`] = c.grade.manualScore;
                    }
                });
            });
            manualScoresRef.current[currentStudentIndex] = initial;
        }
        setSelectedRubric(null);
        setShowStudentInfo(false);
        forceUpdate(n => n + 1);
    }, [currentStudentIndex]);

    const manualScores = manualScoresRef.current[currentStudentIndex] ?? {};
    const textEdits = textEditsRef.current[currentStudentIndex] ?? {};
    const isSubmitted = localRecords[currentStudentIndex]?.data.status === 'finalized';

    // Build rubrics for current question only
    const questionRubrics: FlatRubric[] = (currentQuestion?.criteria || []).map((c, ci) => {
        const key = `${currentQuestionIndex}-${ci}`;
        const hasManual = key in manualScores || (c.grade.manualScore !== null && c.grade.manualScore !== undefined);
        return {
            id: key,
            title: c.criterionName || `Criterion ${ci + 1}`,
            description: c.grade.aiJustification || '',
            score: hasManual ? (manualScores[key] ?? c.grade.manualScore!) : null,
            maxScore: c.maxScore,
            aiSuggestedScore: c.grade.aiSuggestedScore,
            highlightedText: c.grade.highlightedText || '',
            justification: textEdits[`${key}-justification`] ?? c.grade.aiJustification ?? '',
            suggestion: textEdits[`${key}-suggestion`] ?? c.grade.aiSuggestion ?? '',
            questionIndex: currentQuestionIndex,
            criterionIndex: ci,
        };
    });

    // All rubrics across all questions (for total score display)
    const allRubrics: FlatRubric[] = (data.questions || []).flatMap((q, qi) =>
        (q.criteria || []).map((c, ci) => {
            const key = `${qi}-${ci}`;
            const hasManual = key in manualScores || (c.grade.manualScore !== null && c.grade.manualScore !== undefined);
            return {
                id: key, title: c.criterionName, description: '', score: hasManual ? (manualScores[key] ?? c.grade.manualScore!) : null,
                maxScore: c.maxScore, aiSuggestedScore: c.grade.aiSuggestedScore, highlightedText: '', justification: '', suggestion: '',
                questionIndex: qi, criterionIndex: ci,
            };
        })
    );

    const updateScore = useCallback((rubricId: string, score: number) => {
        if (!manualScoresRef.current[currentStudentIndex]) manualScoresRef.current[currentStudentIndex] = {};
        manualScoresRef.current[currentStudentIndex][rubricId] = score;
        forceUpdate(n => n + 1);
        // Debounced save
        clearTimeout((updateScore as any)._timer);
        (updateScore as any)._timer = setTimeout(() => saveScore(rubricId, score), 1500);
    }, [currentStudentIndex]);

    const updateText = useCallback((rubricId: string, field: 'justification' | 'suggestion', value: string) => {
        if (!textEditsRef.current[currentStudentIndex]) textEditsRef.current[currentStudentIndex] = {};
        textEditsRef.current[currentStudentIndex][`${rubricId}-${field}`] = value;
        forceUpdate(n => n + 1);
        const textKey = `${rubricId}-${field}`;
        clearTimeout((updateText as any)[textKey]);
        (updateText as any)[textKey] = setTimeout(() => saveText(rubricId, field, value), 1500);
    }, [currentStudentIndex]);

    const saveText = async (rubricId: string, field: 'justification' | 'suggestion', value: string) => {
        setSaving(true);
        try {
            const [qi, ci] = rubricId.split('-').map(Number);
            const update: Record<string, unknown> = { question_index: qi, criterion_index: ci };
            update[field] = value;
            const res = await fetch(`${GRADING_API}/grading-results/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result_id: record.id, student_id: data.studentID, updates: [update] })
            });
            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    setLocalRecords(prev => prev.map(r =>
                        (r.id === record.id || r.data.studentID === data.studentID) ? result.data : r
                    ));
                }
            }
        } catch (e) { console.error('Text save failed:', e); }
        finally { setSaving(false); }
    };

    const saveScore = async (changedKey: string, changedScore: number) => {
        setSaving(true);
        try {
            const [qi, ci] = changedKey.split('-').map(Number);
            const res = await fetch(`${GRADING_API}/grading-results/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    result_id: record.id,
                    student_id: data.studentID,
                    updates: [{ question_index: qi, criterion_index: ci, manual_score: changedScore }]
                })
            });
            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    setLocalRecords(prev => prev.map(r =>
                        (r.id === record.id || r.data.studentID === data.studentID) ? result.data : r
                    ));
                }
            }
        } catch (e) { console.error('Save failed:', e); }
        finally { setSaving(false); }
    };

    const submitGrades = async () => {
        setSaving(true);
        try {
            const allUpdates: { question_index: number; criterion_index: number; manual_score: number }[] = [];
            (record.data.questions || []).forEach((q, qi) => {
                (q.criteria || []).forEach((c, ci) => {
                    const key = `${qi}-${ci}`;
                    const score = manualScores[key] ?? c.grade.manualScore;
                    if (score !== null && score !== undefined) {
                        allUpdates.push({ question_index: qi, criterion_index: ci, manual_score: score });
                    }
                });
            });
            const res = await fetch(`${GRADING_API}/grading-results/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result_id: record.id, student_id: data.studentID, updates: allUpdates, finalize: true })
            });
            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    setLocalRecords(prev => prev.map(r =>
                        (r.id === record.id || r.data.studentID === data.studentID) ? result.data : r
                    ));
                }
            }
        } catch (e) { console.error('Submit failed:', e); }
        finally { setSaving(false); }
    };

    const handleBack = () => { onRecordsUpdate?.(localRecords); onBack(); };

    // Count how many students have all criteria scored for a given question
    const questionProgress = (qi: number) => {
        return localRecords.filter(r => {
            const q = r.data.questions?.[qi];
            if (!q) return false;
            return q.criteria.every(c => c.grade.manualScore !== null && c.grade.manualScore !== undefined);
        }).length;
    };

    return (
        <div className="bg-[#fafbff] h-screen flex flex-col">
            {/* Top Bar */}
            <div className="bg-[#cee5ff] p-4 shadow-sm flex-shrink-0 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center gap-2">
                            <ChevronLeft className="size-4" /> Back
                        </Button>
                        <h2 className="text-xl font-medium">{data.examTitle}</h2>
                    </div>

                    {/* Question navigation — center */}
                    {totalQuestions > 1 && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <FileText className="size-4" />
                            <span>Question {currentQuestionIndex + 1} of {totalQuestions}</span>
                            <Button variant="ghost" size="sm" onClick={() => { setCurrentQuestionIndex(i => Math.max(0, i - 1)); setSelectedRubric(null); }} disabled={currentQuestionIndex === 0}>
                                <ChevronLeft className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setCurrentQuestionIndex(i => Math.min(totalQuestions - 1, i + 1)); setSelectedRubric(null); }} disabled={currentQuestionIndex === totalQuestions - 1}>
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="size-4" />
                        <span>Student {currentStudentIndex + 1} of {localRecords.length}</span>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStudentIndex(i => Math.max(0, i - 1))} disabled={currentStudentIndex === 0}>
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentStudentIndex(i => Math.min(localRecords.length - 1, i + 1))} disabled={currentStudentIndex === localRecords.length - 1}>
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden items-stretch">
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

                {/* Student answer for current question */}
                <div className="flex-1 p-4 overflow-y-auto">

                    <div className="mb-4 p-4 bg-white rounded-lg shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="size-5 text-blue-600" />
                            <div>
                                {showStudentInfo ? (
                                    <>
                                        <p className="text-sm font-medium text-gray-800">{data.studentName}</p>
                                        <p className="text-xs text-gray-500">{data.studentID}</p>
                                    </>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">Student identity and total score hidden</p>
                                )}
                            </div>
                            <button
                                onClick={() => setShowStudentInfo(v => !v)}
                                className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                                title={showStudentInfo ? 'Hide student info' : 'Show student info'}
                            >
                                {showStudentInfo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                        </div>
                        {showStudentInfo && (
                            <div className="flex items-end gap-4">
                                {questionRubrics && questionRubrics.length > 0 && (() => {
                                    const qScored = questionRubrics.filter(r => r.score !== null);
                                    const qTotal = qScored.reduce((s, r) => s + (r.score as number), 0);
                                    const qMax = questionRubrics.reduce((s, r) => s + r.maxScore, 0);
                                    return (
                                        <div className="text-right">
                                            <div className="text-sm text-blue-400">This Question</div>
                                            <div className="text-lg font-semibold text-blue-600">
                                                {qScored.length === 0 ? '—' : qTotal} / {qMax}
                                            </div>
                                        </div>
                                    );
                                })()}
                                <TotalScore rubrics={allRubrics} />
                            </div>
                        )}
                    </div>

                    {currentQuestion && (
                        <Card className="p-6">
                            {totalQuestions > 1 && (
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                                    Q{currentQuestion.questionNumber}: {currentQuestion.questionText}
                                </p>
                            )}
                            <div className="prose prose-lg max-w-none">
                                <HighlightedAnswer
                                    text={currentQuestion.studentAnswer?.answerText || ''}
                                    highlight={selectedRubric ? (questionRubrics.find(r => r.id === selectedRubric)?.highlightedText || '') : ''}
                                />
                            </div>
                        </Card>
                    )}
                </div>

                {/* Drag divider */}
                <div
                    style={{ width: '8px', cursor: 'col-resize', flexShrink: 0, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseDown={onDividerMouseDown}
                    onMouseEnter={e => (e.currentTarget.style.background = '#dbeafe')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}
                >
                    <div style={{ width: '2px', height: '48px', borderRadius: '9999px', background: '#9ca3af' }} />
                </div>

                {/* Right panel — criteria for current question only */}
                <div style={{ width: rightWidth }} className="p-4 flex flex-col h-full overflow-hidden flex-shrink-0">
                    <h3 className="text-lg font-semibold text-[#2c2828] mb-3 flex-shrink-0">
                        {totalQuestions > 1 ? `Q${currentQuestion?.questionNumber ?? currentQuestionIndex + 1} Criteria` : 'Criteria'}
                    </h3>

                    <div className="flex-1 space-y-4 overflow-y-auto px-1">
                        {questionRubrics.map((rubric) => (
                            <RubricCard
                                key={rubric.id}
                                rubric={rubric}
                                isSelected={selectedRubric === rubric.id}
                                onSelect={() => setSelectedRubric(selectedRubric === rubric.id ? null : rubric.id)}
                                onScoreUpdate={(score) => updateScore(rubric.id, score)}
                                onTextUpdate={(field, value) => updateText(rubric.id, field, value)}
                                hasUserEdited={rubric.score !== null || isSubmitted}
                            />
                        ))}
                    </div>

                    <div className="mt-auto pt-4 border-t border-gray-200 flex-shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                {saving ? 'Saving...' : isSubmitted ? 'Finalized' : ''}
                            </div>
                            {isSubmitted ? (
                                <div className="flex items-center gap-2">
                                    <span className="px-3 py-1.5 rounded text-sm font-semibold bg-green-100 text-green-800 border border-green-300">✓ Submitted</span>
                                    <Button variant="outline" size="sm" onClick={async () => {
                                        // Unfinalize
                                        const res = await fetch(`${GRADING_API}/grading-results/update`, {
                                            method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ result_id: record.id, student_id: data.studentID, updates: [], finalize: false })
                                        });
                                        if (res.ok) {
                                            const result = await res.json();
                                            if (result.success) setLocalRecords(prev => prev.map(r =>
                                                (r.id === record.id || r.data.studentID === data.studentID) ? result.data : r
                                            ));
                                        }
                                    }}>Re-edit</Button>
                                </div>
                            ) : (
                                <Button className="bg-[#3edf04] text-[#52af30] border border-[#3edf04] hover:bg-[#2fc503]"
                                    onClick={submitGrades} disabled={saving}>
                                    {saving ? 'Submitting...' : 'Submit'}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
// ─── Main page ────────────────────────────────────────────────────────────────

type View = { type: 'exams' } | { type: 'students'; examId: string } | { type: 'grading'; examId: string; studentIndex: number };

export function GradingResultsPage() {
    const [records, setRecords] = useState<GradingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<View>({ type: 'exams' });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => { loadResults(); }, []);

    const loadResults = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${GRADING_API}/grading-results`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) { const d = await res.json(); setRecords(d.data || []); setLoading(false); return; }
        } catch { /* fall through */ }
        try {
            const res = await fetch('/src/data/grading_results.json');
            if (res.ok) { const d = await res.json(); setRecords(Array.isArray(d) ? d : []); }
        } catch { /* ignore */ }
        setLoading(false);
    };

    const examGroups = records.reduce<Record<string, GradingRecord[]>>((acc, r) => {
        // Group by rubric title (examTitle) so the display shows the rubric name, not the ID
        const key = r.data?.examTitle || r.data?.examId || r._metadata?.assignment_id || 'unknown';
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="bg-[#fafbff] min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading grading results...</p>
                </div>
            </div>
        );
    }

    if (view.type === 'grading') {
        const examRecords = examGroups[view.examId] || [];
        return (
            <GradingView
                records={examRecords}
                initialIndex={view.studentIndex}
                onBack={() => setView({ type: 'students', examId: view.examId })}
                onRecordsUpdate={(updated) => {
                    // Replace records that were updated — match by id or studentID+examId
                    setRecords(prev => {
                        const result = [...prev];
                        updated.forEach(u => {
                            const idx = result.findIndex(r =>
                                (u.id && r.id === u.id) ||
                                (r.data?.studentID === u.data?.studentID && r.data?.examId === u.data?.examId)
                            );
                            if (idx >= 0) result[idx] = u;
                        });
                        return result;
                    });
                }}
            />
        );
    }

    if (view.type === 'students') {
        const examRecords = examGroups[view.examId] || [];
        return (
            <div className="flex min-h-screen bg-[#fafbff]">
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
                <div className="flex-1">
                    <StudentList
                        records={examRecords}
                        onSelect={(i) => setView({ type: 'grading', examId: view.examId, studentIndex: i })}
                        onBack={() => setView({ type: 'exams' })}
                        onToggleSidebar={() => setSidebarCollapsed(c => !c)}
                        sidebarCollapsed={sidebarCollapsed}
                    />
                </div>
            </div>
        );
    }

    // Exam list
    return (
        <div className="flex min-h-screen bg-[#fafbff]">
            <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
            <div className="flex-1">
                <div className="bg-[#cee5ff] p-4 shadow-sm flex items-center gap-3">
                    {sidebarCollapsed && (
                        <Button variant="ghost" size="sm" onClick={() => setSidebarCollapsed(c => !c)} className="flex items-center">
                            <Menu className="size-4" />
                        </Button>
                    )}
                    <h1 className="text-xl font-medium">Grading Results</h1>
                </div>
                <div className="p-8" style={{ paddingLeft: '3rem', paddingRight: '3rem' }}>
                    <p className="text-sm text-gray-500 mb-6">Select an exam to start grading</p>

                    {Object.keys(examGroups).length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <FileText className="size-12 mx-auto mb-4 opacity-30" />
                            <p>No grading results yet. Run grading from the Student Answers page.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(examGroups).map(([examId, recs]) => (
                                <ExamCard key={examId} examId={examId} records={recs} onSelect={() => setView({ type: 'students', examId })} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
