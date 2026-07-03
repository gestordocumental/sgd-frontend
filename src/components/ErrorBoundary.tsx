import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

type FallbackRender = (resetErrorBoundary: () => void) => ReactNode;

interface Props {
  fallback: ReactNode | FallbackRender;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      const fallbackNode = typeof fallback === 'function' ? fallback(this.reset) : fallback;

      if (import.meta.env.DEV && this.state.error) {
        return (
          <div>
            {fallbackNode}
            <details
              style={{
                margin: '12px',
                padding: '8px',
                border: '1px solid #f87171',
                borderRadius: '4px',
                background: '#fef2f2',
              }}
              open
            >
              <summary
                style={{ cursor: 'pointer', fontWeight: 600, fontSize: '12px', color: '#dc2626' }}
              >
                [DEV] Error details
              </summary>
              <pre
                style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  whiteSpace: 'pre-wrap',
                  color: '#7f1d1d',
                }}
              >
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          </div>
        );
      }

      return fallbackNode;
    }
    return this.props.children;
  }
}
