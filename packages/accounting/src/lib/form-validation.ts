import type { ApiFieldErrors } from "@paprel/embed-core";

export function validationMessage(code: string, field = ""): string {
  if (code === "LENGTH_3_TO_200") return "Enter between 3 and 200 characters.";
  if (code === "INVALID_VALUE" && field.endsWith("account_id")) return "Select a valid account.";
  if (code === "INVALID_VALUE") return "Select a valid value.";
  if (code === "REQUIRED" || code === "MISSING_VALUE") return "This field is required.";
  if (code === "INVALID_DATE") return "Enter a valid date.";
  if (code === "INVALID_NUMBER") return "Enter a valid number.";
  return code.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) + ".";
}

export function validationMessages(errors: ApiFieldErrors, field: string): string[] {
  return (errors[field] ?? []).map((code) => validationMessage(code, field));
}

export function withoutValidationField(errors: ApiFieldErrors, field: string): ApiFieldErrors {
  if (!errors[field]) return errors;
  const { [field]: _removed, ...remaining } = errors;
  return remaining;
}

export function hasUnmappedValidation(
  errors: ApiFieldErrors,
  isInlineField: (field: string) => boolean,
): boolean {
  return Object.keys(errors).some((field) => !isInlineField(field));
}
