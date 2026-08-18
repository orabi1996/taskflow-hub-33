// Structured error logger: prints a rich console group + returns a friendly message.
// Use together with toast.error(formatErrorMessage(e)) at call sites.
import { formatErrorMessage } from "./error-messages";

export interface LogErrorOptions {
  /** Short scope tag, e.g. "createEmployee" */
  scope: string;
  /** Optional sanitized context (do NOT pass passwords/tokens) */
  context?: Record<string, unknown>;
  /** Fallback user-facing message */
  fallback?: string;
}

function classify(err: unknown): string {
  if (err && typeof err === "object" && Array.isArray((err as any).issues)) return "ZodError";
  if (typeof Response !== "undefined" && err instanceof Response) return `HTTP ${err.status}`;
  if (err instanceof Error) return err.name || "Error";
  return typeof err;
}

function redact(ctx?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (/password|token|secret|authorization/i.test(k)) {
      out[k] = typeof v === "string" && v.length > 0 ? `***(${v.length})` : "***";
    } else {
      out[k] = v;
    }
  }
  return out;
}

/** Logs the error with structured context and returns a user-friendly Arabic message. */
export function logError(err: unknown, opts: LogErrorOptions): string {
  const traceId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const friendly = formatErrorMessage(err, opts.fallback ?? "فشلت العملية");
  const kind = classify(err);

  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `%c[${opts.scope}]%c ${kind} — ${friendly} %c(${traceId})`,
    "color:#fff;background:#dc2626;padding:2px 6px;border-radius:4px;font-weight:bold",
    "color:inherit;font-weight:600",
    "color:#888;font-weight:normal",
  );
  if (opts.context) console.log("context:", redact(opts.context));
  if (err && typeof err === "object" && Array.isArray((err as any).issues)) {
    console.table((err as any).issues);
  }
  if (typeof Response !== "undefined" && err instanceof Response) {
    console.log("status:", err.status, err.statusText);
    console.log("url:", err.url);
  }
  console.log("raw:", err);
  if (err instanceof Error && err.stack) console.log(err.stack);
  console.groupEnd();

  return friendly;
}
