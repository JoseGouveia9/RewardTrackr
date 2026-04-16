import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { ThemeProvider } from "./theme-context";
import App from "./App";

export function Provider() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
