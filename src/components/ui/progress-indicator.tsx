import React from 'react';
import { CheckCircle, Clock, AlertCircle, Upload } from 'lucide-react';
import { cn } from './utils';

export interface ProgressStep {
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'in-progress' | 'completed' | 'error';
    progress?: number; // 0-100 for in-progress steps
}

interface ProgressIndicatorProps {
    steps: ProgressStep[];
    className?: string;
    orientation?: 'horizontal' | 'vertical';
    showProgress?: boolean;
}

export function ProgressIndicator({
    steps,
    className,
    orientation = 'vertical',
    showProgress = true
}: ProgressIndicatorProps) {
    const getStepIcon = (step: ProgressStep) => {
        switch (step.status) {
            case 'completed':
                return <CheckCircle className="size-5 text-green-600" />;
            case 'in-progress':
                return <Clock className="size-5 text-blue-600 animate-pulse" />;
            case 'error':
                return <AlertCircle className="size-5 text-red-600" />;
            default:
                return <div className="size-5 rounded-full border-2 border-gray-300" />;
        }
    };

    const getStepColor = (step: ProgressStep) => {
        switch (step.status) {
            case 'completed':
                return 'text-green-800 bg-green-50 border-green-200';
            case 'in-progress':
                return 'text-blue-800 bg-blue-50 border-blue-200';
            case 'error':
                return 'text-red-800 bg-red-50 border-red-200';
            default:
                return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    if (orientation === 'horizontal') {
        return (
            <div className={cn('flex items-center space-x-4', className)}>
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center space-y-2">
                            <div className={cn(
                                'flex items-center justify-center size-10 rounded-full border-2',
                                getStepColor(step)
                            )}>
                                {getStepIcon(step)}
                            </div>
                            <div className="text-center">
                                <div className="text-sm font-medium">{step.title}</div>
                                {step.description && (
                                    <div className="text-xs text-gray-500">{step.description}</div>
                                )}
                                {showProgress && step.status === 'in-progress' && step.progress !== undefined && (
                                    <div className="text-xs text-blue-600">{step.progress}%</div>
                                )}
                            </div>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={cn(
                                'flex-1 h-0.5',
                                step.status === 'completed' ? 'bg-green-300' : 'bg-gray-300'
                            )} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    }

    return (
        <div className={cn('space-y-4', className)}>
            {steps.map((step, index) => (
                <div key={step.id} className="flex items-start space-x-3">
                    <div className="flex flex-col items-center">
                        <div className={cn(
                            'flex items-center justify-center size-8 rounded-full border-2',
                            getStepColor(step)
                        )}>
                            {getStepIcon(step)}
                        </div>
                        {index < steps.length - 1 && (
                            <div className={cn(
                                'w-0.5 h-8 mt-2',
                                step.status === 'completed' ? 'bg-green-300' : 'bg-gray-300'
                            )} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{step.title}</div>
                        {step.description && (
                            <div className="text-sm text-gray-500 mt-1">{step.description}</div>
                        )}
                        {showProgress && step.status === 'in-progress' && step.progress !== undefined && (
                            <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                    <span>Progress</span>
                                    <span>{step.progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${step.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

interface FileUploadProgressProps {
    fileName: string;
    progress: number;
    status: 'uploading' | 'processing' | 'completed' | 'error';
    error?: string;
    className?: string;
}

export function FileUploadProgress({
    fileName,
    progress,
    status,
    error,
    className
}: FileUploadProgressProps) {
    const getStatusColor = () => {
        switch (status) {
            case 'completed':
                return 'text-green-600';
            case 'error':
                return 'text-red-600';
            case 'processing':
                return 'text-yellow-600';
            default:
                return 'text-blue-600';
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'uploading':
                return 'Uploading...';
            case 'processing':
                return 'Processing...';
            case 'completed':
                return 'Completed';
            case 'error':
                return 'Failed';
            default:
                return 'Pending';
        }
    };

    return (
        <div className={cn('bg-white border rounded-lg p-4', className)}>
            <div className="flex items-center space-x-3 mb-3">
                <Upload className={cn('size-5', getStatusColor())} />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                        {fileName}
                    </div>
                    <div className={cn('text-sm', getStatusColor())}>
                        {getStatusText()}
                    </div>
                </div>
                <div className={cn('text-sm font-medium', getStatusColor())}>
                    {progress}%
                </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                    className={cn(
                        'h-2 rounded-full transition-all duration-300',
                        status === 'error' ? 'bg-red-500' :
                            status === 'completed' ? 'bg-green-500' :
                                'bg-blue-500'
                    )}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {error && (
                <div className="text-sm text-red-600 mt-2">
                    {error}
                </div>
            )}
        </div>
    );
}