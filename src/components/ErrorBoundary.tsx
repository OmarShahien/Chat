import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string | null;
  onReset?: () => void;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('UI ErrorBoundary caught an error:', error, info);
  }

  private handleRecover = (): void => {
    this.setState({ hasError: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex-1 h-full w-full bg-[#0a1630] text-[#eaf2ff] flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="max-w-sm space-y-2">
            <h2 className="text-[18px] font-semibold">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h2>
            <p className="text-[13.5px] text-[#8fa7cc]">
              We ran into an unexpected display issue. Your messages are safe.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleRecover}
              className="px-4 py-2 rounded-[8px] bg-[#3b82f6] hover:bg-[#60a5fa] text-white text-[13.5px] font-medium cursor-pointer"
            >
              {this.props.onReset ? 'Back to chats' : 'Try again'}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-[8px] bg-[#12254a] hover:bg-[#1d3764] border border-[#1d3764] text-[#eaf2ff] text-[13.5px] cursor-pointer"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
