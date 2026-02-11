import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({
            error,
            errorInfo
        });

        // Call optional error handler
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
                        <div className="mb-4">
                            <AlertTriangle className="size-12 text-red-500 mx-auto mb-4" />
                            <h1 className="text-xl font-semibold text-gray-900 mb-2">
                                Something went wrong
                            </h1>
                            <p className="text-gray-600 mb-4">
                                An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button
                                onClick={this.handleRetry}
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="size-4" />
                                Try Again
                            </Button>

                            <Button
                                variant="outline"
                                onClick={this.handleGoHome}
                                className="w-full flex items-center justify-center gap-2"
                            >
                                <Home className="size-4" />
                                Go Home
                            </Button>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-6 text-left">
                                <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                                    Error Details (Development)
                                </summary>
                                <div className="bg-gray-100 p-3 rounded text-xs font-mono overflow-auto max-h-40">
                                    <div className="text-red-600 font-semibold mb-2">
                                        {this.state.error.name}: {this.state.error.message}
                                    </div>
                                    <div className="text-gray-700">
                                        {this.state.error.stack}
                                    </div>
                                    {this.state.errorInfo && (
                                        <div className="mt-2 pt-2 border-t border-gray-300">
                                            <div className="text-gray-600 font-semibold mb-1">Component Stack:</div>
                                            <div className="text-gray-700">
                                                {this.state.errorInfo.componentStack}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

// Hook version for functional components
export function useErrorHandler() {
    const handleError = (error: Error, context?: string) => {
        console.error(`Error${context ? ` in ${context}` : ''}:`, error);

        // You could integrate with error reporting service here
        // e.g., Sentry, LogRocket, etc.

        throw error; // Re-throw to trigger error boundary
    };

    return { handleError };
}