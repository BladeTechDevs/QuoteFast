'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // TODO: send to Sentry or similar error tracking
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-800">
            Algo salió mal
          </h2>
          <p className="text-sm text-gray-500 max-w-sm">
            Ocurrió un error inesperado. Por favor recarga la página o intenta
            de nuevo.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
