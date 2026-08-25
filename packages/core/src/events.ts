export const PAPREL_EVENT_VERSION = 1 as const;

export const PAPREL_EVENTS = {
  viewChange: "paprel:view-change",
  resourceOpen: "paprel:resource-open",
  operationSuccess: "paprel:operation-success",
} as const;

export type PaprelViewChangeReason =
  | "filter"
  | "page"
  | "page-size"
  | "search"
  | "sort"
  | "tab";

export type PaprelViewStateValue =
  | boolean
  | number
  | string
  | null
  | undefined
  | readonly string[];

export type PaprelViewState = Readonly<Record<string, PaprelViewStateValue>>;

export interface PaprelEventSource {
  /** The custom-element tag that emitted the event. */
  component: string;
}

export interface PaprelViewChangeDetail {
  version: typeof PAPREL_EVENT_VERSION;
  source: PaprelEventSource;
  reason: PaprelViewChangeReason;
  state: PaprelViewState;
}

export interface PaprelResourceOpenDetail {
  version: typeof PAPREL_EVENT_VERSION;
  source: PaprelEventSource;
  resource: string;
  id: string;
}

export interface PaprelOperationSuccessDetail {
  version: typeof PAPREL_EVENT_VERSION;
  source: PaprelEventSource;
  action: string;
  message: string;
  resource?: { type: string; id?: string };
}

export function dispatchPaprelViewChange(
  target: EventTarget,
  detail: Omit<PaprelViewChangeDetail, "version">,
): boolean {
  return target.dispatchEvent(
    new CustomEvent<PaprelViewChangeDetail>(PAPREL_EVENTS.viewChange, {
      bubbles: true,
      composed: true,
      detail: { version: PAPREL_EVENT_VERSION, ...detail },
    }),
  );
}

export function dispatchPaprelResourceOpen(
  target: EventTarget,
  detail: Omit<PaprelResourceOpenDetail, "version">,
): boolean {
  return target.dispatchEvent(
    new CustomEvent<PaprelResourceOpenDetail>(PAPREL_EVENTS.resourceOpen, {
      bubbles: true,
      cancelable: true,
      composed: true,
      detail: { version: PAPREL_EVENT_VERSION, ...detail },
    }),
  );
}

export function dispatchPaprelOperationSuccess(
  target: EventTarget,
  detail: Omit<PaprelOperationSuccessDetail, "version">,
): boolean {
  return target.dispatchEvent(
    new CustomEvent<PaprelOperationSuccessDetail>(PAPREL_EVENTS.operationSuccess, {
      bubbles: true,
      composed: true,
      detail: { version: PAPREL_EVENT_VERSION, ...detail },
    }),
  );
}

declare global {
  interface HTMLElementEventMap {
    "paprel:resource-open": CustomEvent<PaprelResourceOpenDetail>;
    "paprel:view-change": CustomEvent<PaprelViewChangeDetail>;
    "paprel:operation-success": CustomEvent<PaprelOperationSuccessDetail>;
  }
}
