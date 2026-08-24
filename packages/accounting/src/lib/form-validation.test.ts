import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasUnmappedValidation, validationMessages, withoutValidationField } from "./form-validation.js";

describe("form validation helpers", () => {
  const errors = { account: ["REQUIRED"], lines_0_account_id: ["INVALID_VALUE"] };

  it("turns API codes into field-aware copy", () => {
    assert.deepEqual(validationMessages(errors, "account"), ["This field is required."]);
    assert.deepEqual(validationMessages(errors, "lines_0_account_id"), ["Select a valid account."]);
  });

  it("clears only the edited field", () => {
    assert.deepEqual(withoutValidationField(errors, "account"), {
      lines_0_account_id: ["INVALID_VALUE"],
    });
  });

  it("detects errors that cannot be rendered inline", () => {
    assert.equal(hasUnmappedValidation(errors, (field) => field === "account"), true);
  });
});
