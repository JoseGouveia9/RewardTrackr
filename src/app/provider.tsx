import { BrowserRouter } from "react-router";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary";
import { ThemeProvider } from "./theme-context";
import App from "./App";

export function Provider() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
