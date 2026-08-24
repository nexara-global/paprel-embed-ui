export type ApiFieldErrors = Record<string, string[]>;

export class PaprelApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors: ApiFieldErrors;
  readonly raw?: unknown;

  constructor(message: string, opts: { code?: string; status?: number; fieldErrors?: ApiFieldErrors; raw?: unknown }) {
    super(message);
    this.name = "PaprelApiError";
    this.code = opts.code ?? "UNKNOWN";
    this.status = opts.status ?? 0;
    this.fieldErrors = opts.fieldErrors ?? {};
    this.raw = opts.raw;
  }
}

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    message?: string;
    code?: string;
    backend_message?: string;
    fields?: ApiFieldErrors;
    validation?: Array<{ field?: string; message?: string }>;
    [field: string]: unknown;
  };
};

export function parseEnvelope<T>(status: number, body: unknown): T {
  if (body && typeof body === "object" && "error" in body && (body as ApiEnvelope<T>).error) {
    const envelope = body as ApiEnvelope<T>;
    const err = envelope.error!;
    const fieldErrors = normalizeFieldErrors(err);
    throw new PaprelApiError(err.message ?? err.backend_message ?? "Request failed", {
      code: err.code ?? err.message ?? "API_ERROR",
      status,
      fieldErrors,
      raw: body,
    });
  }

  if (body && typeof body === "object" && "data" in body) {
    return (body as ApiEnvelope<T>).data as T;
  }

  return body as T;
}

function normalizeFieldErrors(error: NonNullable<ApiEnvelope<unknown>["error"]>): ApiFieldErrors {
  if (error.fields) return error.fields;

  const map: ApiFieldErrors = {};
  if (error.message === "VALIDATION_FAILED" && Array.isArray(error.validation)) {
    for (const item of error.validation) {
      const field = item.field ?? "form";
      if (!map[field]) map[field] = [];
      if (item.message) map[field].push(item.message);
    }
  }

  // Some APIs return validation fields directly under `error`, for example
  // { error: { description: ["LENGTH_3_TO_200"], lines_0_account_id: ["INVALID_VALUE"] } }.
  // Preserve those paths so every form can attach feedback to the relevant control.
  const envelopeKeys = new Set(["message", "code", "backend_message", "fields", "validation"]);
  for (const [field, value] of Object.entries(error)) {
    if (envelopeKeys.has(field) || !Array.isArray(value)) continue;
    const messages = value.filter((item): item is string => typeof item === "string" && item.length > 0);
    if (messages.length) map[field] = messages;
  }
  return map;
}
