import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

interface RetryButtonProps {
    onRetry: () => Promise<void> | void;
    disabled?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    className?: string;
    children?: React.ReactNode;
    size?: 'sm' | 'default' | 'lg';
    variant?: 'default' | 'outline' | 'ghost';
}

export function RetryButton({
    onRetry,
    disabled = false,
    maxRetries = 3,
    retryDelay = 1000,
    className,
    children = 'Retry',
    size = 'default',
    variant = 'outline'
}: RetryButtonProps) {
    const [isRetrying, setIsRetrying] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [lastError, setLastError] = useState<string | null>(null);

    const handleRetry = async () => {
        if (isRetrying || disabled || retryCount >= maxRetries) return;

        setIsRetrying(true);
        setLastError(null);

        try {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            await onRetry();
            setRetryCount(0); // Reset on success
        } catch (error) {
            setRetryCount(prev => prev + 1);
            setLastError(error instanceof Error ? error.message : 'Retry failed');
            console.error('Retry failed:', error);
        } finally {
            setIsRetrying(false);
        }
    };

    const isMaxRetriesReached = retryCount >= maxRetries;

    return (
        <div className="space-y-2">
            <Button
                onClick={handleRetry}
                disabled={disabled || isRetrying || isMaxRetriesReached}
                variant={variant}
                size={size}
                className={cn(
                    'flex items-center gap-2',
                    isMaxRetriesReached && 'opacity-50',
                    className
                )}
            >
                <RefreshCw className={cn(
                    'size-4',
                    isRetrying && 'animate-spin'
                )} />
                {isRetrying ? 'Retrying...' : children}
                {retryCount > 0 && !isRetrying && (
                    <span className="text-xs opacity-70">
                        ({retryCount}/{maxRetries})
                    </span>
                )}
            </Button>

            {lastError && (
                <p className="text-xs text-red-600">
                    {lastError}
                </p>
            )}

            {isMaxRetriesReached && (
                <p className="text-xs text-gray-500">
                    Maximum retry attempts reached. Please refresh the page or contact support.
                </p>
            )}
        </div>
    );
}