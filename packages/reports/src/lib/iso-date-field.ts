import { html, type TemplateResult } from "lit";
import { normalizeIsoDate } from "@paprel/accounting";

type IsoDateFieldOptions = { required?: boolean; id?: string };

export function isoDateField(value: string, onChange: (value: string) => void, options: IsoDateFieldOptions = {}): TemplateResult {
  return html`<input class="iso-date-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" placeholder="YYYY-MM-DD" maxlength="10" pattern="\\d{4}-\\d{2}-\\d{2}" title="YYYY-MM-DD" id=${options.id ?? ""} .value=${normalizeIsoDate(value)} ?required=${options.required ?? false} @change=${(event: Event) => onChange(normalizeIsoDate((event.target as HTMLInputElement).value))} />`;
}
