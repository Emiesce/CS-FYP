import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Users, BookOpen, GraduationCap } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Card } from '../components/ui/card';

export function DashboardPage() {
    const navigate = useNavigate();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const cards = [
        {
            title: 'Rubric Management',
            description: 'Create and manage grading rubrics with scoring criteria',
            icon: <BookOpen className="size-8 text-blue-500" />,
            path: '/rubric-upload',
            color: 'border-blue-200 hover:border-blue-400',
        },
        {
            title: 'Student Answers',
            description: 'Upload student answers and run AI grading',
            icon: <Users className="size-8 text-green-500" />,
            path: '/student-answers',
            color: 'border-green-200 hover:border-green-400',
        },
        {
            title: 'Grading Results',
            description: 'View, edit and submit graded exam results',
            icon: <GraduationCap className="size-8 text-purple-500" />,
            path: '/grading',
            color: 'border-purple-200 hover:border-purple-400',
        },
    ];

    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

            <div className="flex-1" style={{ padding: '2rem', paddingLeft: '3rem' }}>
                <div className="mb-8">
                    <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
                    <p className="text-gray-500 mt-1">AI-powered essay grading system</p>
                </div>
                <div className="mt-10 p-6 bg-white rounded-xl border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <FileText className="size-5 text-gray-500" /> Quick Start
                    </h2>
                    <ol className="space-y-2 text-sm text-gray-600 list-decimal list-inside">
                        <li>1. Create a rubric in <strong>Rubric Management</strong> with questions and scoring criteria</li>
                        <li>Optionally upload lecture notes to the rubric for context-aware grading</li>
                        <li>2.Go to <strong>Student Answers</strong>, select the rubric, upload answers and click Run Grading</li>
                        <li>3. Review and edit scores in <strong>Grading Results</strong>, then submit</li>
                    </ol>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {cards.map((card) => (
                        <Card
                            key={card.path}
                            className={`p-6 cursor-pointer border-2 transition-all hover:shadow-md ${card.color}`}
                            onClick={() => navigate(card.path)}
                        >
                            <div className="mb-4">{card.icon}</div>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h2>
                            <p className="text-sm text-gray-500">{card.description}</p>
                        </Card>
                    ))}
                </div>

            </div>
        </div>
    );
}
