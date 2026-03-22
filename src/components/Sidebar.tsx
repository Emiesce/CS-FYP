import React from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface SidebarProps {
    collapsed: boolean;
    onToggle?: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const navigationItems = [
        { path: "/dashboard", label: "Dashboard", icon: null },
        { path: "/grading", label: "Grading", icon: null },
        { path: "/rubric-upload", label: "Rubric Management", icon: null },
        { path: "/student-answers", label: "Student Answers", icon: null },
        { path: "/analytics", label: "Analytics", icon: null },
        { path: "/proctoring", label: "Proctoring", icon: null },
    ];

    const isActive = (path: string) => {
        if (path === "/" && location.pathname === "/") return true;
        if (path !== "/" && location.pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <>
            {/* Collapsed toggle button — visible only when sidebar is hidden */}
            {collapsed && onToggle && (
                <button
                    onClick={onToggle}
                    style={{ position: 'fixed', top: '16px', left: '16px', zIndex: 50 }}
                    className="p-2 bg-white rounded shadow hover:bg-gray-100 transition-colors text-gray-600"
                    title="Open sidebar"
                >
                    ☰
                </button>
            )}

            <div className={`${collapsed ? 'w-0' : 'w-[306px]'} bg-white shadow-lg min-h-screen transition-all duration-300 overflow-hidden flex-shrink-0`}>
                <div className="p-6 w-[306px] min-h-full flex flex-col">
                    {/* AI Grader Header */}
                    <div className="flex items-center justify-between gap-2 mb-8">
                        <div className="flex items-center gap-2">
                            <div className="size-[37px] bg-gradient-to-br from-[#4B40C9] to-[#5FAEE6] rounded-full flex items-center justify-center">
                                <span className="text-white font-medium">AI</span>
                            </div>
                            <div>
                                <h1 className="text-[26px] font-semibold text-black">AI Grader</h1>
                            </div>
                        </div>
                        {onToggle && (
                            <button
                                onClick={onToggle}
                                className="p-2 rounded hover:bg-gray-100 transition-colors text-gray-500"
                                title="Toggle sidebar"
                            >
                                ☰
                            </button>
                        )}
                    </div>

                    {/* Navigation */}
                    <nav className="space-y-4 flex-1">
                        {navigationItems.map((item) => (
                            <div
                                key={item.path}
                                className={`flex items-center gap-3 p-3 rounded cursor-pointer transition-colors ${isActive(item.path)
                                    ? "text-white bg-[#5E86E5]"
                                    : "text-[#9197b3] hover:text-gray-700 hover:bg-gray-50"
                                    }`}
                                onClick={() => navigate(item.path)}
                            >
                                <div className="size-6" />
                                <span>{item.label}</span>
                                <ChevronRight className="ml-auto size-4" />
                            </div>
                        ))}
                    </nav>

                    {/* Bottom Profile */}
                    <div className="flex items-center gap-3 mt-auto pt-6">
                        <div className="size-[49px] bg-gradient-to-br from-[#4B40C9] to-[#5FAEE6] rounded-full" />
                        <div>
                            <div className="font-medium text-sm">Peter Chan</div>
                            <div className="text-xs text-[#757575]">TA - MGMT T2</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}