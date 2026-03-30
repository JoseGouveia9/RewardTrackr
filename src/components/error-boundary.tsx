import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import "./error-boundary.css";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/** Class-based error boundary that catches render errors and renders a fallback with a retry button. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  /** Derives error state from the thrown error for the fallback render. */
  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return { hasError: true, message };
  }

  /** Reports the caught error and component stack to Sentry. */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  /** Renders the children normally, or the fallback UI when an error has been caught. */
  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <p className="error-boundary-message">{this.state.message}</p>
          <button
            className="error-boundary-retry"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
