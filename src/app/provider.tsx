import { ErrorBoundary } from "@/components/error-boundary";
import App from "./App";

export function Provider() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
