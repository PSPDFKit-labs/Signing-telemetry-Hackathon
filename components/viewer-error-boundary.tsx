'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ViewerErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Document viewer error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-lg border h-full min-h-[400px]">
          <div className="text-center p-6">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">Failed to load document viewer</p>
            <p className="text-xs text-muted-foreground mt-2">Please try refreshing the page.</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 text-sm bg-zinc-200 dark:bg-zinc-800 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
