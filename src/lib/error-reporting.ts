// Error reporting helper — replaces the Lovable error tracker.
// Now logs to console; wire up your preferred monitoring SDK here
// (e.g. Sentry, Datadog, LogRocket) when deploying.

export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[ErrorBoundary]", error, context);
  // TODO: add your monitoring SDK call here, e.g. Sentry.captureException(error)
}

// Alias for backwards compatibility — can be removed once all callers are updated
export const reportLovableError = reportError;
