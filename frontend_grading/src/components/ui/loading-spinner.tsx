import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from './utils';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
    text?: string;
    variant?: 'default' | 'overlay' | 'inline';
}

const sizeClasses = {
    sm: 'size-4',
    md: 'size-6',
    lg: 'size-8',
    xl: 'size-12'
};

export function LoadingSpinner({
    size = 'md',
    className,
    text,
    variant = 'default'
}: LoadingSpinnerProps) {
    const spinner = (
        <Loader2 className={cn(
            'animate-spin',
            sizeClasses[size],
            className
        )} />
    );

    if (variant === 'overlay') {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-4">
                    {spinner}
                    {text && <p className="text-gray-700">{text}</p>}
                </div>
            </div>
        );
    }

    if (variant === 'inline') {
        return (
            <div className="flex items-center space-x-2">
                {spinner}
                {text && <span className="text-gray-600">{text}</span>}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center space-y-2">
            {spinner}
            {text && <p className="text-gray-600 text-sm">{text}</p>}
        </div>
    );
}

interface LoadingSkeletonProps {
    className?: string;
    lines?: number;
    variant?: 'text' | 'card' | 'avatar' | 'button';
}

export function LoadingSkeleton({
    className,
    lines = 1,
    variant = 'text'
}: LoadingSkeletonProps) {
    const baseClasses = 'animate-pulse bg-gray-200 rounded';

    if (variant === 'card') {
        return (
            <div className={cn('space-y-3', className)}>
                <div className={cn(baseClasses, 'h-4 w-3/4')} />
                <div className={cn(baseClasses, 'h-4 w-1/2')} />
                <div className={cn(baseClasses, 'h-20 w-full')} />
            </div>
        );
    }

    if (variant === 'avatar') {
        return (
            <div className={cn(baseClasses, 'size-10 rounded-full', className)} />
        );
    }

    if (variant === 'button') {
        return (
            <div className={cn(baseClasses, 'h-10 w-24', className)} />
        );
    }

    return (
        <div className={cn('space-y-2', className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <div
                    key={i}
                    className={cn(
                        baseClasses,
                        'h-4',
                        i === lines - 1 ? 'w-2/3' : 'w-full'
                    )}
                />
            ))}
        </div>
    );
}

interface LoadingStateProps {
    isLoading: boolean;
    children: React.ReactNode;
    fallback?: React.ReactNode;
    className?: string;
}

export function LoadingState({
    isLoading,
    children,
    fallback,
    className
}: LoadingStateProps) {
    if (isLoading) {
        return (
            <div className={className}>
                {fallback || <LoadingSpinner text="Loading..." />}
            </div>
        );
    }

    return <>{children}</>;
}