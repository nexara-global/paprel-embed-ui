import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dispatchPaprelResourceOpen,
  dispatchPaprelViewChange,
  PAPREL_EVENTS,
} from "./events.js";

describe("Paprel host events", () => {
  it("emits versioned view state", () => {
    const target = new EventTarget();
    let received: CustomEvent | undefined;
    target.addEventListener(PAPREL_EVENTS.viewChange, (event) => {
      received = event as CustomEvent;
    });

    dispatchPaprelViewChange(target, {
      source: { component: "paprel-journal-list" },
      reason: "page",
      state: { page: 2, pageSize: 25 },
    });

    assert.deepEqual(received?.detail, {
      version: 1,
      source: { component: "paprel-journal-list" },
      reason: "page",
      state: { page: 2, pageSize: 25 },
    });
  });

  it("allows the host to cancel resource navigation", () => {
    const target = new EventTarget();
    target.addEventListener(PAPREL_EVENTS.resourceOpen, (event) => event.preventDefault());

    const accepted = dispatchPaprelResourceOpen(target, {
      source: { component: "paprel-journal-list" },
      resource: "journal",
      id: "journal-1",
    });

    assert.equal(accepted, false);
  });
});
