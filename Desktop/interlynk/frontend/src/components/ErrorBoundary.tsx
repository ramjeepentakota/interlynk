import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional fallback renderer. Receives the error and a reset() callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Catches render-time and lifecycle errors anywhere
 * below in the tree and shows a recoverable fallback instead of a blank screen
 * — previously, any uncaught throw in a deeply-nested chat or call component
 * would unmount the entire app and force a hard refresh.
 *
 * The reset() callback re-renders the children, which is usually enough when
 * the error was a transient state issue (e.g. malformed websocket payload).
 * For genuinely broken state, the user can hit "Reload app" which does a hard
 * navigation to /.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the console signal — devs grep for "ErrorBoundary" during triage.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  reload = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            color: '#f1f5f9',
            fontFamily: 'system-ui, sans-serif',
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ opacity: 0.75, marginBottom: 16 }}>
              The app hit an unexpected error. Try recovering, and if it keeps happening, reload.
            </p>
            <pre
              style={{
                textAlign: 'left',
                background: '#1e293b',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                overflowX: 'auto',
                marginBottom: 16,
              }}
            >
              {this.state.error.message}
            </pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button
                onClick={this.reset}
                style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  borderRadius: 6,
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                Try again
              </button>
              <button
                onClick={this.reload}
                style={{
                  padding: '8px 16px',
                  background: '#475569',
                  color: 'white',
                  borderRadius: 6,
                  border: 0,
                  cursor: 'pointer',
                }}
              >
                Reload app
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
