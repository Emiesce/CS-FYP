import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from './utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
    clearToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newToast = { ...toast, id };

        setToasts(prev => [...prev, newToast]);

        // Auto-remove toast after duration
        const duration = toast.duration ?? (toast.type === 'error' ? 8000 : 5000);
        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const clearToasts = useCallback(() => {
        setToasts([]);
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
            {children}
            <ToastContainer />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

function ToastContainer() {
    const { toasts } = useToast();

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} />
            ))}
        </div>
    );
}

function ToastItem({ toast }: { toast: Toast }) {
    const { removeToast } = useToast();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger animation
        const timer = setTimeout(() => setIsVisible(true), 10);
        return () => clearTimeout(timer);
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => removeToast(toast.id), 150);
    };

    const getIcon = () => {
        switch (toast.type) {
            case 'success':
                return <CheckCircle className="size-5 text-green-600" />;
            case 'error':
                return <AlertCircle className="size-5 text-red-600" />;
            case 'warning':
                return <AlertTriangle className="size-5 text-yellow-600" />;
            case 'info':
                return <Info className="size-5 text-blue-600" />;
        }
    };

    const getStyles = () => {
        switch (toast.type) {
            case 'success':
                return 'bg-green-50 border-green-200 text-green-800';
            case 'error':
                return 'bg-red-50 border-red-200 text-red-800';
            case 'warning':
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            case 'info':
                return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    return (
        <div
            className={cn(
                'border rounded-lg shadow-lg p-4 transition-all duration-300 transform',
                getStyles(),
                isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
            )}
        >
            <div className="flex items-start gap-3">
                {getIcon()}
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium">{toast.title}</h4>
                    {toast.description && (
                        <p className="text-sm opacity-90 mt-1">{toast.description}</p>
                    )}
                    {toast.action && (
                        <button
                            onClick={toast.action.onClick}
                            className="text-sm font-medium underline mt-2 hover:no-underline"
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="size-4" />
                </button>
            </div>
        </div>
    );
}

// Convenience functions
export const toast = {
    success: (title: string, description?: string, options?: Partial<Toast>) => {
        const context = useToast();
        context.addToast({ type: 'success', title, description, ...options });
    },
    error: (title: string, description?: string, options?: Partial<Toast>) => {
        const context = useToast();
        context.addToast({ type: 'error', title, description, ...options });
    },
    warning: (title: string, description?: string, options?: Partial<Toast>) => {
        const context = useToast();
        context.addToast({ type: 'warning', title, description, ...options });
    },
    info: (title: string, description?: string, options?: Partial<Toast>) => {
        const context = useToast();
        context.addToast({ type: 'info', title, description, ...options });
    }
};