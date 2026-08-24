import type { HttpClient } from "@paprel/embed-core";
import type { JournalDetail, JournalForm, JournalListResult, JournalSummary, ListJournalsParams } from "../types.js";

function mapJournalSummary(raw: unknown): JournalSummary {
  const row = raw as Record<string, unknown>;
  return {
    ...(row as JournalSummary),
    id: String(row.id ?? ""),
    posted: Boolean(row.posted ?? row.is_posted),
  };
}

/** Core returns `{ journals, total_records, page_number, page_size }` inside the envelope data. */
export function normalizeJournalListResponse(data: unknown): JournalListResult {
  if (Array.isArray(data)) {
    return { journals: data.map(mapJournalSummary) };
  }

  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.journals)) {
      return {
        journals: obj.journals.map(mapJournalSummary),
        totalRecords: Number(obj.total_records ?? obj.totalRecords ?? 0),
        pageNumber: Number(obj.page_number ?? obj.pageNumber ?? 1),
        pageSize: Number(obj.page_size ?? obj.pageSize ?? 0),
      };
    }
    if (Array.isArray(obj.items)) {
      return { journals: obj.items.map(mapJournalSummary) };
    }
  }

  return { journals: [] };
}

/** Normalize journal mutations while tolerating the legacy one-item array during rollout. */
export function normalizeJournalMutationResponse(data: unknown): JournalDetail {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.journal && typeof obj.journal === "object") {
      return obj.journal as JournalDetail;
    }
    if (Array.isArray(obj.journals) && obj.journals[0]) {
      return obj.journals[0] as JournalDetail;
    }
  }

  return data as JournalDetail;
}

export function createJournalsResource(http: HttpClient) {
  return {
    async list(params: ListJournalsParams = {}): Promise<JournalListResult> {
      const data = await http.request<unknown>("GET", "/v1/accounting/journals", {
        query: {
          page: params.page,
          page_size: params.pageSize,
          date_range: params.dateRange,
          posted: params.posted,
          manual: params.manual,
          reference: params.reference,
          identifier: params.identifier,
          void: params.voided,
          reversed: params.reversed,
        },
      });
      return normalizeJournalListResponse(data);
    },

    async getById(journalId: string): Promise<JournalDetail> {
      return http.request<JournalDetail>("GET", `/v1/accounting/journals/${journalId}`);
    },

    async create(form: JournalForm): Promise<JournalDetail> {
      const data = await http.request<unknown>("POST", "/v1/accounting/journals", {
        body: form,
      });
      return normalizeJournalMutationResponse(data);
    },

    async update(journalId: string, form: JournalForm): Promise<JournalDetail> {
      const data = await http.request<unknown>("PUT", `/v1/accounting/journals/${journalId}`, {
        body: form,
      });
      return normalizeJournalMutationResponse(data);
    },

    async voidJournal(payload: { journal_id: string; reason?: string }): Promise<unknown> {
      return http.request("PUT", "/v1/accounting/journals/void", {
        body: payload,
      });
    },

    async delete(journalId: string): Promise<void> {
      await http.request("DELETE", `/v1/accounting/journals/${journalId}`);
    },
  };
}

export type JournalsResource = ReturnType<typeof createJournalsResource>;
