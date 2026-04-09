import { memo, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ChevronLeft, ChevronRight, Users, FileText, Menu } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';

const GRADING_API = 'http://localhost:5000';

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
    questionNumber: number;
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
    score: number;
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
            const score = manualScores[key] ?? c.grade.manualScore ?? c.grade.aiSuggestedScore;
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
            const pct = (r.score / r.maxScore) * 100;
            const color = pct >= 80 ? 'bg-green-100 text-green-800' : pct >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
            return <Badge key={r.id} className={color}>{r.score}/{r.maxScore}</Badge>;
        })}
    </div>
));

// ─── TotalScore (same as GradingPage) ────────────────────────────────────────

const TotalScore = memo(({ rubrics }: { rubrics: FlatRubric[] }) => {
    const total = useMemo(() => ({
        current: rubrics.reduce((s, r) => s + r.score, 0),
        maximum: rubrics.reduce((s, r) => s + r.maxScore, 0),
    }), [rubrics]);
    return (
        <div className="text-right">
            <div className="text-sm text-gray-600">Total Score</div>
            <div className="text-lg font-semibold">{total.current} / {total.maximum}</div>
        </div>
    );
});

// ─── RubricCard (same as GradingPage) ────────────────────────────────────────

const RubricCard = memo(({ rubric, isSelected, onSelect, onScoreUpdate, hasUserEdited }: {
    rubric: FlatRubric;
    isSelected: boolean;
    onSelect: () => void;
    onScoreUpdate: (score: number) => void;
    hasUserEdited: boolean;
}) => (
    <Card className={`p-6 cursor-pointer transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`} onClick={onSelect}>
        <h4 className="text-xl font-semibold text-[#2c2828] mb-2">{rubric.title}</h4>

        {/* AI justification as the main description */}
        {rubric.justification && (
            <p className="text-sm text-gray-700 mb-4 leading-relaxed">{rubric.justification}</p>
        )}

        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Score:</span>
                    <Input
                        type="number"
                        min="0"
                        max={rubric.maxScore}
                        step={0.5}
                        value={rubric.score}
                        onChange={(e) => onScoreUpdate(parseFloat(e.target.value) || 0)}
                        className="w-16 text-center"
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

            {/* AI suggested score — shown after user edits */}
            {hasUserEdited && (
                <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
                    <span className="text-sm font-medium text-blue-600">AI suggested score:</span>
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

            {/* Suggestion */}
            {rubric.suggestion && (
                <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-medium text-blue-600 mb-1">Suggestion</p>
                    <p className="text-sm text-blue-800">{rubric.suggestion}</p>
                </div>
            )}
        </div>
    </Card>
));

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
                    <p className="text-xs text-gray-500 mt-0.5">Rubric: {records[0]?._metadata?.marking_scheme_id}</p>
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

// ─── Grading view — exact GradingPage layout ──────────────────────────────────

function GradingView({ records, initialIndex, onBack }: {
    records: GradingRecord[];
    initialIndex: number;
    onBack: () => void;
}) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
    const [selectedRubric, setSelectedRubric] = useState<string | null>(null);
    const [manualScores, setManualScores] = useState<Record<string, number>>({});
    const [editedKeys, setEditedKeys] = useState<Set<string>>(new Set());
    const [lastSaved, setLastSaved] = useState(new Date());
    const [saving, setSaving] = useState(false);
    const [localRecords, setLocalRecords] = useState(records);
    const debouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Persist manual scores per student index across navigation
    const allManualScoresRef = useRef<Record<number, Record<string, number>>>({});

    const record = localRecords[currentIndex];
    const { data } = record;

    // Initialize manualScores from existing manualScore values in the record
    useEffect(() => {
        // First check if we have locally edited scores for this student
        if (allManualScoresRef.current[currentIndex]) {
            setManualScores(allManualScoresRef.current[currentIndex]);
            setEditedKeys(new Set());
            setSelectedRubric(null);
            return;
        }
        // Otherwise load from the record's saved manualScore values
        const initial: Record<string, number> = {};
        (localRecords[currentIndex]?.data.questions || []).forEach((q, qi) => {
            (q.criteria || []).forEach((c, ci) => {
                if (c.grade.manualScore !== null && c.grade.manualScore !== undefined) {
                    initial[`${qi}-${ci}`] = c.grade.manualScore;
                }
            });
        });
        setManualScores(initial);
        setEditedKeys(new Set());
        setSelectedRubric(null);
    }, [currentIndex]);

    const rubrics = buildFlatRubrics(record, manualScores);
    const essay = buildEssayText(record);

    const getHighlightedText = useCallback((text: string, rubricId: string) => {
        if (!rubricId || selectedRubric !== rubricId) return text;
        const rubric = rubrics.find(r => r.id === rubricId);
        if (!rubric?.highlightedText) return text;
        const esc = rubric.highlightedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return text.replace(
            new RegExp(esc, 'g'),
            `<span class="bg-blue-200 text-blue-800 px-1 rounded">${rubric.highlightedText}</span>`
        );
    }, [selectedRubric, rubrics]);

    const updateRubricScore = useCallback((rubricId: string, score: number) => {
        setManualScores(prev => {
            const updated = { ...prev, [rubricId]: score };
            // Persist to ref so navigation doesn't lose the changes
            allManualScoresRef.current[currentIndex] = updated;
            return updated;
        });
        setEditedKeys(prev => new Set(prev).add(rubricId));

        // Debounced auto-save
        if (debouncedRef.current) clearTimeout(debouncedRef.current);
        debouncedRef.current = setTimeout(() => saveGrades(rubricId, score), 1500);
    }, [currentIndex]);

    const saveGrades = useCallback(async (changedKey?: string, changedScore?: number) => {
        setSaving(true);
        try {
            const currentScores = { ...manualScores };
            if (changedKey !== undefined && changedScore !== undefined) {
                currentScores[changedKey] = changedScore;
            }

            const updates = Array.from(editedKeys).map(key => {
                const [qi, ci] = key.split('-').map(Number);
                return { question_index: qi, criterion_index: ci, manual_score: currentScores[key] ?? manualScores[key] };
            });
            if (changedKey && !editedKeys.has(changedKey) && changedScore !== undefined) {
                const [qi, ci] = changedKey.split('-').map(Number);
                updates.push({ question_index: qi, criterion_index: ci, manual_score: changedScore });
            }

            if (updates.length === 0) { setSaving(false); return; }

            const res = await fetch(`${GRADING_API}/grading-results/update`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ result_id: record.id, student_id: data.studentID, updates })
            });

            if (res.ok) {
                const result = await res.json();
                if (result.success) {
                    setLocalRecords(prev => prev.map(r =>
                        (r.id === record.id || r.data.studentID === data.studentID) ? result.data : r
                    ));
                    // Clear the ref cache — data is now persisted in localRecords
                    delete allManualScoresRef.current[currentIndex];
                    setEditedKeys(new Set());
                    setLastSaved(new Date());
                }
            }
        } catch (e) {
            console.error('Save failed:', e);
        } finally {
            setSaving(false);
        }
    }, [manualScores, editedKeys, record.id, data.studentID]);

    const submitGrades = useCallback(async () => {
        await saveGrades();
    }, [saveGrades]);

    const hasUserEditedScore = (rubricId: string) => editedKeys.has(rubricId);

    const prevStudent = () => { if (currentIndex > 0) setCurrentIndex(i => i - 1); };
    const nextStudent = () => { if (currentIndex < localRecords.length - 1) setCurrentIndex(i => i + 1); };

    return (
        <div className="bg-[#fafbff] min-h-screen relative">
            {/* Top Bar — exact copy of GradingPage */}
            <div className="bg-[#cee5ff] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-2">
                            <ChevronLeft className="size-4" /> Back
                        </Button>
                        <h2 className="text-xl font-medium">{data.examTitle}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Users className="size-4" />
                            <span>Student {currentIndex + 1} of {localRecords.length}</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={prevStudent} disabled={currentIndex === 0} className="flex items-center gap-2">
                            <ChevronLeft className="size-4" /> Prev
                        </Button>
                        <Button variant="ghost" size="sm" onClick={nextStudent} disabled={currentIndex === localRecords.length - 1} className="flex items-center gap-2">
                            Next <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex">
                {/* Sidebar */}
                <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

                {/* Main Content — essay */}
                <div className="flex-1 p-4">
                    {/* Student Info Header */}
                    <div className="mb-4 p-4 bg-white rounded-lg shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <FileText className="size-5 text-blue-600" />
                                    <div>
                                        <p className="text-sm text-gray-600">Student ID: {data.studentID}</p>
                                        <p className="text-sm font-medium text-gray-800">{data.studentName}</p>
                                    </div>
                                </div>
                                <StudentBadges rubrics={rubrics} />
                            </div>
                            <TotalScore rubrics={rubrics} />
                        </div>
                    </div>

                    {/* Essay */}
                    <Card className="p-6 mb-4">
                        <div className="prose prose-lg max-w-none">
                            <div dangerouslySetInnerHTML={{ __html: getHighlightedText(essay, selectedRubric || '') }} />
                        </div>
                    </Card>
                </div>

                {/* Right Panel — Rubrics grouped by question */}
                <div className="w-[535px] p-4 space-y-6 flex flex-col h-[calc(100vh-80px)]">
                    <h3 className="text-2xl font-semibold text-[#2c2828] underline">Rubrics descriptions</h3>

                    <div className="flex-1 space-y-6 overflow-y-auto px-1 py-1">
                        {/* Group rubrics by questionIndex */}
                        {(() => {
                            const groups: Record<number, FlatRubric[]> = {};
                            rubrics.forEach(r => {
                                if (!groups[r.questionIndex]) groups[r.questionIndex] = [];
                                groups[r.questionIndex].push(r);
                            });
                            return Object.entries(groups).map(([qi, groupRubrics]) => {
                                const questionText = data.questions[Number(qi)]?.questionText;
                                const hasMultipleCriteria = groupRubrics.length > 1;
                                return (
                                    <div key={qi}>
                                        {/* Question heading — only show if there are multiple criteria under it */}
                                        {hasMultipleCriteria && questionText && (
                                            <div className="mb-2 px-1">
                                                <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                                                    Q{Number(qi) + 1}: {questionText}
                                                </p>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    {groupRubrics.reduce((s, r) => s + r.score, 0).toFixed(1)} / {groupRubrics.reduce((s, r) => s + r.maxScore, 0)} pts
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-4 pl-0">
                                            {groupRubrics.map((rubric) => (
                                                <RubricCard
                                                    key={rubric.id}
                                                    rubric={rubric}
                                                    isSelected={selectedRubric === rubric.id}
                                                    onSelect={() => setSelectedRubric(selectedRubric === rubric.id ? null : rubric.id)}
                                                    onScoreUpdate={(score) => updateRubricScore(rubric.id, score)}
                                                    hasUserEdited={hasUserEditedScore(rubric.id)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* Bottom — last saved + submit (exact GradingPage) */}
                    <div className="mt-auto pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-500">
                                {saving ? 'Saving...' : `Last saved: ${lastSaved.toLocaleTimeString()}`}
                            </div>
                            <Button
                                className="bg-[#3edf04] text-[#52af30] border border-[#3edf04] hover:bg-[#2fc503]"
                                onClick={submitGrades}
                            >
                                Submit
                            </Button>
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
        const key = r.data?.examId || r._metadata?.assignment_id || 'unknown';
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
