import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../ui/alert-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import {
    Edit,
    Save,
    X,
    Plus,
    Trash2,
    Calendar,
    BookOpen,
    FileText,
    AlertTriangle,
    Link
} from 'lucide-react';
import { RubricData, RubricQuestion, ScoringCriterion, Course, Assignment } from '../../types';

interface RubricDetailModalProps {
    rubric: RubricData | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (id: string, updates: Partial<RubricData>) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
    onAssignToAssignment: (rubricId: string, assignmentId: string) => Promise<boolean>;
    courses: Course[];
    assignments: Assignment[];
    isUpdating?: boolean;
    isDeleting?: boolean;
    isAssigning?: boolean;
}

interface EditState {
    title: string;
    description: string;
    questions: RubricQuestion[];
    courseId?: string;
    assignmentId?: string;
}

export function RubricDetailModal({
    rubric,
    isOpen,
    onClose,
    onUpdate,
    onDelete,
    onAssignToAssignment,
    courses,
    assignments,
    isUpdating = false,
    isDeleting = false,
    isAssigning = false
}: RubricDetailModalProps) {
    const [isEditMode, setIsEditMode] = useState(false);
    const [editState, setEditState] = useState<EditState>({
        title: '',
        description: '',
        questions: [],
        courseId: undefined,
        assignmentId: undefined
    });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Initialize edit state when rubric changes
    useEffect(() => {
        if (rubric) {
            setEditState({
                title: rubric.title,
                description: rubric.description,
                questions: rubric.questions.map(q => ({ ...q })), // Deep copy
                courseId: rubric.courseId,
                assignmentId: rubric.assignmentId
            });
        }
    }, [rubric]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setIsEditMode(false);
            setErrors({});
            setShowDeleteConfirm(false);
        }
    }, [isOpen]);

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    };

    const getCourseById = (courseId?: string) => {
        return courses.find(c => c.id === courseId);
    };

    const getAssignmentById = (assignmentId?: string) => {
        return assignments.find(a => a.id === assignmentId);
    };

    const getFilteredAssignments = () => {
        if (!editState.courseId) return assignments;
        return assignments.filter(a => a.courseId === editState.courseId);
    };

    // Validation functions
    const validateForm = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        if (!editState.title.trim()) {
            newErrors.title = 'Title is required';
        }

        if (editState.questions.length === 0) {
            newErrors.questions = 'At least one question is required';
        }

        editState.questions.forEach((question, qIndex) => {
            if (!question.title.trim()) {
                newErrors[`question-${qIndex}-title`] = 'Question title is required';
            }

            if (question.minScore < 0) {
                newErrors[`question-${qIndex}-minScore`] = 'Minimum score cannot be negative';
            }

            if (question.maxScore <= question.minScore) {
                newErrors[`question-${qIndex}-maxScore`] = 'Maximum score must be greater than minimum score';
            }

            if (question.maxScore > 100) {
                newErrors[`question-${qIndex}-maxScore`] = 'Maximum score cannot exceed 100';
            }

            question.scoringCriteria.forEach((criterion, cIndex) => {
                if (!criterion.description.trim()) {
                    newErrors[`criterion-${qIndex}-${cIndex}-description`] = 'Criterion description is required';
                }

                if (!criterion.scoreRange.trim()) {
                    newErrors[`criterion-${qIndex}-${cIndex}-scoreRange`] = 'Score range is required';
                }
            });
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [editState]);

    // Edit mode handlers
    const handleEditToggle = () => {
        if (isEditMode) {
            // Cancel edit - reset to original values
            if (rubric) {
                setEditState({
                    title: rubric.title,
                    description: rubric.description,
                    questions: rubric.questions.map(q => ({ ...q })),
                    courseId: rubric.courseId,
                    assignmentId: rubric.assignmentId
                });
            }
            setErrors({});
        }
        setIsEditMode(!isEditMode);
    };

    const handleSave = async () => {
        if (!rubric || !validateForm()) return;

        const totalMinPoints = editState.questions.reduce((sum, q) => sum + q.minScore, 0);
        const totalMaxPoints = editState.questions.reduce((sum, q) => sum + q.maxScore, 0);

        const updates: Partial<RubricData> = {
            title: editState.title,
            description: editState.description,
            questions: editState.questions,
            totalMinPoints,
            totalMaxPoints,
            courseId: editState.courseId,
            assignmentId: editState.assignmentId,
            updatedAt: new Date()
        };

        const success = await onUpdate(rubric.id, updates);
        if (success) {
            setIsEditMode(false);
            setErrors({});
        }
    };

    const handleDelete = async () => {
        if (!rubric) return;

        const success = await onDelete(rubric.id);
        if (success) {
            setShowDeleteConfirm(false);
            onClose();
        }
    };

    const handleAssignmentChange = async (assignmentId: string) => {
        if (!rubric) return;

        setEditState(prev => ({ ...prev, assignmentId }));

        // If not in edit mode, immediately assign the rubric
        if (!isEditMode) {
            await onAssignToAssignment(rubric.id, assignmentId);
        }
    };

    // Question management handlers
    const addQuestion = () => {
        const newQuestion: RubricQuestion = {
            id: `q-${Date.now()}`,
            title: '',
            description: '',
            minScore: 0,
            maxScore: 10,
            scoringCriteria: []
        };

        setEditState(prev => ({
            ...prev,
            questions: [...prev.questions, newQuestion]
        }));
    };

    const updateQuestion = (questionId: string, updates: Partial<RubricQuestion>) => {
        setEditState(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === questionId ? { ...q, ...updates } : q
            )
        }));
    };

    const removeQuestion = (questionId: string) => {
        setEditState(prev => ({
            ...prev,
            questions: prev.questions.filter(q => q.id !== questionId)
        }));
    };

    const addScoringCriterion = (questionId: string) => {
        const newCriterion: ScoringCriterion = {
            id: `c-${Date.now()}`,
            scoreRange: '',
            description: '',
            minPoints: 0,
            maxPoints: 0
        };

        setEditState(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === questionId
                    ? { ...q, scoringCriteria: [...q.scoringCriteria, newCriterion] }
                    : q
            )
        }));
    };

    const updateScoringCriterion = (
        questionId: string,
        criterionId: string,
        updates: Partial<ScoringCriterion>
    ) => {
        setEditState(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === questionId
                    ? {
                        ...q,
                        scoringCriteria: q.scoringCriteria.map(c =>
                            c.id === criterionId ? { ...c, ...updates } : c
                        )
                    }
                    : q
            )
        }));
    };

    const removeScoringCriterion = (questionId: string, criterionId: string) => {
        setEditState(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === questionId
                    ? {
                        ...q,
                        scoringCriteria: q.scoringCriteria.filter(c => c.id !== criterionId)
                    }
                    : q
            )
        }));
    };

    if (!rubric) return null;

    const currentCourse = getCourseById(isEditMode ? editState.courseId : rubric.courseId);
    const currentAssignment = getAssignmentById(isEditMode ? editState.assignmentId : rubric.assignmentId);
    const totalMinPoints = editState.questions.reduce((sum, q) => sum + q.minScore, 0);
    const totalMaxPoints = editState.questions.reduce((sum, q) => sum + q.maxScore, 0);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-2xl font-bold text-[#2c2828]">
                                {isEditMode ? 'Edit Rubric' : 'Rubric Details'}
                            </DialogTitle>
                            <div className="flex items-center gap-2">
                                {!isEditMode && (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleEditToggle}
                                            disabled={isUpdating}
                                        >
                                            <Edit className="w-4 h-4 mr-2" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowDeleteConfirm(true)}
                                            disabled={isDeleting}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                        </Button>
                                    </>
                                )}
                                {isEditMode && (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleEditToggle}
                                            disabled={isUpdating}
                                        >
                                            <X className="w-4 h-4 mr-2" />
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleSave}
                                            disabled={isUpdating}
                                        >
                                            <Save className="w-4 h-4 mr-2" />
                                            {isUpdating ? 'Saving...' : 'Save'}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-6">
                            {/* Basic Information */}
                            <Card className="p-4">
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="title">Title</Label>
                                        {isEditMode ? (
                                            <div>
                                                <Input
                                                    id="title"
                                                    value={editState.title}
                                                    onChange={(e) => setEditState(prev => ({ ...prev, title: e.target.value }))}
                                                    className={errors.title ? 'border-red-500' : ''}
                                                />
                                                {errors.title && (
                                                    <p className="text-red-500 text-sm mt-1">{errors.title}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-lg font-semibold mt-1">{rubric.title}</p>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="description">Description</Label>
                                        {isEditMode ? (
                                            <Textarea
                                                id="description"
                                                value={editState.description}
                                                onChange={(e) => setEditState(prev => ({ ...prev, description: e.target.value }))}
                                                rows={3}
                                            />
                                        ) : (
                                            <p className="text-gray-600 mt-1">{rubric.description || 'No description provided'}</p>
                                        )}
                                    </div>

                                    {/* Metadata */}
                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-4 h-4" />
                                            <span>Created {formatDate(rubric.createdAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            <span>{editState.questions.length} question{editState.questions.length !== 1 ? 's' : ''}</span>
                                        </div>
                                        <Badge variant="outline">
                                            {totalMinPoints}-{totalMaxPoints} pts
                                        </Badge>
                                    </div>
                                </div>
                            </Card>

                            {/* Assignment Association */}
                            <Card className="p-4">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Link className="w-5 h-5" />
                                    Assignment Association
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <Label htmlFor="course">Course</Label>
                                        {isEditMode ? (
                                            <Select
                                                value={editState.courseId || ''}
                                                onValueChange={(value: string) => setEditState(prev => ({
                                                    ...prev,
                                                    courseId: value || undefined,
                                                    assignmentId: undefined // Reset assignment when course changes
                                                }))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a course" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="">No course</SelectItem>
                                                    {courses.map(course => (
                                                        <SelectItem key={course.id} value={course.id}>
                                                            {course.code} - {course.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="flex items-center gap-2 mt-1">
                                                <BookOpen className="w-4 h-4" />
                                                <span>{currentCourse ? `${currentCourse.code} - ${currentCourse.name}` : 'Not assigned to a course'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <Label htmlFor="assignment">Assignment</Label>
                                        {isEditMode ? (
                                            <Select
                                                value={editState.assignmentId || ''}
                                                onValueChange={handleAssignmentChange}
                                                disabled={!editState.courseId}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select an assignment" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="">No assignment</SelectItem>
                                                    {getFilteredAssignments().map(assignment => (
                                                        <SelectItem key={assignment.id} value={assignment.id}>
                                                            {assignment.title}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="flex items-center gap-2 mt-1">
                                                <FileText className="w-4 h-4" />
                                                <span>{currentAssignment ? currentAssignment.title : 'Not assigned to an assignment'}</span>
                                                {!isEditMode && !currentAssignment && (
                                                    <Select
                                                        value=""
                                                        onValueChange={handleAssignmentChange}
                                                        disabled={isAssigning || !currentCourse}
                                                    >
                                                        <SelectTrigger className="w-48">
                                                            <SelectValue placeholder="Assign to..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {getFilteredAssignments().map(assignment => (
                                                                <SelectItem key={assignment.id} value={assignment.id}>
                                                                    {assignment.title}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>

                            {/* Questions */}
                            <Card className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold">Questions & Criteria</h3>
                                    {isEditMode && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={addQuestion}
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Add Question
                                        </Button>
                                    )}
                                </div>

                                {errors.questions && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                        <p className="text-red-600 text-sm">{errors.questions}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    {editState.questions.map((question, qIndex) => (
                                        <Card key={question.id} className="p-4 border-l-4 border-l-blue-500">
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 space-y-2">
                                                        <Label>Question {qIndex + 1}</Label>
                                                        {isEditMode ? (
                                                            <div>
                                                                <Input
                                                                    value={question.title}
                                                                    onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
                                                                    placeholder="Question title"
                                                                    className={errors[`question-${qIndex}-title`] ? 'border-red-500' : ''}
                                                                />
                                                                {errors[`question-${qIndex}-title`] && (
                                                                    <p className="text-red-500 text-sm mt-1">{errors[`question-${qIndex}-title`]}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="font-medium">{question.title}</p>
                                                        )}
                                                    </div>
                                                    {isEditMode && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeQuestion(question.id)}
                                                            className="text-red-600 hover:text-red-700"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Score Range */}
                                                <div className="flex gap-4">
                                                    <div className="flex-1">
                                                        <Label>Min Score</Label>
                                                        {isEditMode ? (
                                                            <div>
                                                                <Input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={question.minScore}
                                                                    onChange={(e) => updateQuestion(question.id, { minScore: parseFloat(e.target.value) || 0 })}
                                                                    className={errors[`question-${qIndex}-minScore`] ? 'border-red-500' : ''}
                                                                />
                                                                {errors[`question-${qIndex}-minScore`] && (
                                                                    <p className="text-red-500 text-sm mt-1">{errors[`question-${qIndex}-minScore`]}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="mt-1">{question.minScore}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <Label>Max Score</Label>
                                                        {isEditMode ? (
                                                            <div>
                                                                <Input
                                                                    type="number"
                                                                    step="0.1"
                                                                    value={question.maxScore}
                                                                    onChange={(e) => updateQuestion(question.id, { maxScore: parseFloat(e.target.value) || 0 })}
                                                                    className={errors[`question-${qIndex}-maxScore`] ? 'border-red-500' : ''}
                                                                />
                                                                {errors[`question-${qIndex}-maxScore`] && (
                                                                    <p className="text-red-500 text-sm mt-1">{errors[`question-${qIndex}-maxScore`]}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="mt-1">{question.maxScore}</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Description */}
                                                {(question.description || isEditMode) && (
                                                    <div>
                                                        <Label>Description</Label>
                                                        {isEditMode ? (
                                                            <Textarea
                                                                value={question.description || ''}
                                                                onChange={(e) => updateQuestion(question.id, { description: e.target.value })}
                                                                placeholder="Optional question description"
                                                                rows={2}
                                                            />
                                                        ) : (
                                                            <p className="text-gray-600 mt-1">{question.description}</p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Scoring Criteria */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <Label>Scoring Criteria</Label>
                                                        {isEditMode && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => addScoringCriterion(question.id)}
                                                            >
                                                                <Plus className="w-4 h-4 mr-1" />
                                                                Add Criterion
                                                            </Button>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        {question.scoringCriteria.map((criterion, cIndex) => (
                                                            <div key={criterion.id} className="flex gap-2 items-start p-2 bg-gray-50 rounded">
                                                                <div className="flex-1 space-y-2">
                                                                    {isEditMode ? (
                                                                        <>
                                                                            <div className="flex gap-2">
                                                                                <div className="w-24">
                                                                                    <Input
                                                                                        value={criterion.scoreRange}
                                                                                        onChange={(e) => updateScoringCriterion(question.id, criterion.id, { scoreRange: e.target.value })}
                                                                                        placeholder="e.g., 3 or 1-2"
                                                                                        className={errors[`criterion-${qIndex}-${cIndex}-scoreRange`] ? 'border-red-500' : ''}
                                                                                    />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <Input
                                                                                        value={criterion.description}
                                                                                        onChange={(e) => updateScoringCriterion(question.id, criterion.id, { description: e.target.value })}
                                                                                        placeholder="Criterion description"
                                                                                        className={errors[`criterion-${qIndex}-${cIndex}-description`] ? 'border-red-500' : ''}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            {(errors[`criterion-${qIndex}-${cIndex}-scoreRange`] || errors[`criterion-${qIndex}-${cIndex}-description`]) && (
                                                                                <div className="text-red-500 text-sm">
                                                                                    {errors[`criterion-${qIndex}-${cIndex}-scoreRange`] || errors[`criterion-${qIndex}-${cIndex}-description`]}
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex gap-2">
                                                                            <Badge variant="secondary" className="shrink-0">
                                                                                {criterion.scoreRange}
                                                                            </Badge>
                                                                            <span className="text-sm">{criterion.description}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isEditMode && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => removeScoringCriterion(question.id, criterion.id)}
                                                                        className="text-red-600 hover:text-red-700"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {question.scoringCriteria.length === 0 && (
                                                            <p className="text-gray-500 text-sm italic">No scoring criteria defined</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}

                                    {editState.questions.length === 0 && (
                                        <div className="text-center py-8 text-gray-500">
                                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                            <p>No questions defined yet</p>
                                            {isEditMode && (
                                                <Button
                                                    variant="outline"
                                                    className="mt-4"
                                                    onClick={addQuestion}
                                                >
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Add First Question
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </ScrollArea>

                    <DialogFooter>
                        <div className="flex items-center justify-between w-full">
                            <div className="text-sm text-gray-500">
                                Last updated: {formatDate(rubric.updatedAt)}
                            </div>
                            <Button variant="outline" onClick={onClose}>
                                Close
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            Delete Rubric
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{rubric?.title}"? This action cannot be undone.
                            {currentAssignment && (
                                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                                    <strong>Warning:</strong> This rubric is currently assigned to "{currentAssignment.title}".
                                    Deleting it will remove the assignment association.
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}