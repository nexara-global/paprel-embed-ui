import { css, html, LitElement, nothing, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import sharedStyles from "@paprel/embed-ui/styles.css?inline";
import { getEmbedClient } from "../context.js";
import { PaprelApiError } from "../headless.js";
import { todayIsoDate } from "../iso-date.js";
import { hasUnmappedValidation, validationMessages, withoutValidationField } from "../lib/form-validation.js";
import type { TransactionLock, TransactionLockForm, TransactionLockLevel } from "../types.js";
import { dispatchPaprelOperationSuccess } from "@paprel/embed-core";

type StatusFilter = "ACTIVE" | "RELEASED" | "ALL";

@customElement("paprel-transaction-locks")
export class PaprelTransactionLocks extends LitElement {
  static styles = [css`${unsafeCSS(sharedStyles)}`, css`
    :host { display: block; }
    .toolbar, .filters, .actions { display:flex; gap:.65rem; align-items:center; flex-wrap:wrap; }
    .toolbar { justify-content:space-between; margin-bottom:1rem; }
    .intro strong { display:block; font-size:1rem; }
    .intro span { color:var(--paprel-color-text-muted,#6b7280); font-size:.85rem; }
    .filters button { padding:.45rem .8rem; border-radius:999px; }
    .filters button[aria-pressed="true"] { color:var(--paprel-color-primary,#4f46e5); border-color:currentColor; background:var(--paprel-color-primary-soft,#eef2ff); }
    .lock-table tbody tr { cursor:pointer; }
    .lock-table tbody tr:hover { background:var(--paprel-color-surface-muted,#f7f7f4); }
    .level, .status { display:inline-flex; border-radius:999px; padding:.2rem .55rem; font-size:.72rem; font-weight:700; letter-spacing:.04em; }
    .level.hard { background:#fee2e2; color:#991b1b; }
    .level.soft { background:#e0f2fe; color:#075985; }
    .status { background:#ecfdf5; color:#047857; }
    .status.released, .status.void { background:#f3f4f6; color:#4b5563; }
    .panel { border:1px solid var(--paprel-color-border,#e5e7eb); border-radius:var(--paprel-radius,10px); padding:1.1rem; margin-bottom:1rem; background:var(--paprel-color-surface,#fff); }
    .panel-head { display:flex; align-items:start; justify-content:space-between; gap:1rem; margin-bottom:1rem; }
    .panel-head h3 { margin:0; font-size:1rem; }
    .form-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.85rem; }
    .wide { grid-column:span 2; }
    label { display:grid; gap:.35rem; font-size:.78rem; font-weight:650; color:var(--paprel-color-text-muted,#6b7280); }
    input, select, textarea { width:100%; box-sizing:border-box; border:1px solid var(--paprel-color-border,#d1d5db); border-radius:var(--paprel-radius-sm,7px); padding:.65rem .72rem; background:var(--paprel-color-surface,#fff); color:inherit; font:inherit; }
    textarea { min-height:4.75rem; resize:vertical; }
    .form-actions { display:flex; justify-content:flex-end; gap:.6rem; margin-top:1rem; }
    .detail-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:.8rem; }
    .datum { padding:.75rem; background:var(--paprel-color-surface-muted,#f7f7f4); border-radius:var(--paprel-radius-sm,7px); }
    .datum span { display:block; color:var(--paprel-color-text-muted,#6b7280); font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; margin-bottom:.25rem; }
    .datum strong { font-size:.9rem; }
    .reason { grid-column:1/-1; }
    .error { color:#b91c1c; margin:.6rem 0; }
    @media(max-width:760px) { .form-grid,.detail-grid { grid-template-columns:1fr; } .wide,.reason { grid-column:auto; } .hide-mobile { display:none; } }
  `];

  @property({ type:Number }) page = 1;
  @property({ type:Number, attribute:"page-size" }) pageSize = 25;
  @state() private loading = true;
  @state() private acting = false;
  @state() private error = "";
  @state() private success = "";
  @state() private fieldErrors: Record<string, string[]> = {};
  @state() private rows: TransactionLock[] = [];
  @state() private status: StatusFilter = "ACTIVE";
  @state() private showForm = false;
  @state() private selected: TransactionLock | null = null;
  @state() private form: TransactionLockForm = this.emptyForm();

  connectedCallback(): void { super.connectedCallback(); void this.load(); }

  private emptyForm(): TransactionLockForm {
    return { lock_label:"", module_scope:"GLOBAL", lock_level:"SOFT", lock_from_date:todayIsoDate(), lock_to_date:"", reason_text:"", external_ref_id:"" };
  }

  async refresh(): Promise<void> { await this.load(); }

  private async load(): Promise<void> {
    this.loading=true; this.error="";
    try {
      const result=await getEmbedClient().transactionLocks.list({page:this.page,pageSize:this.pageSize,status:this.status === "ALL" ? undefined : this.status});
      this.rows=result.locks;
    } catch(error) { this.rows=[]; this.error=error instanceof Error ? error.message : "Failed to load transaction locks"; }
    finally { this.loading=false; }
  }

  private updateForm(field: keyof TransactionLockForm, event: Event): void {
    this.form={...this.form,[field]:(event.target as HTMLInputElement).value};
    this.fieldErrors=withoutValidationField(this.fieldErrors,field);
  }

  private errorsFor(field: string): string[] { return validationMessages(this.fieldErrors,field); }
  private fieldFeedback(field: string) { const messages=this.errorsFor(field); return messages.length?html`<span class="control-error" role="alert">${messages.join(" ")}</span>`:nothing; }

  private async createLock(event: SubmitEvent): Promise<void> {
    event.preventDefault(); this.acting=true; this.error=""; this.success=""; this.fieldErrors={};
    try {
      const record=await getEmbedClient().transactionLocks.create({...this.form,lock_to_date:this.form.lock_to_date || null,external_ref_id:this.form.external_ref_id || null});
      this.success="Transaction lock created successfully.";
      dispatchPaprelOperationSuccess(this,{source:{component:"paprel-transaction-locks"},action:"transaction-lock.created",message:this.success,resource:{type:"transaction-lock",id:record.id?String(record.id):undefined}});
      this.form=this.emptyForm(); this.showForm=false; await this.load();
    } catch(error) {
      if(error instanceof PaprelApiError) {
        this.fieldErrors=error.fieldErrors;
        const inlineFields=new Set(["lock_label","module_scope","lock_level","lock_from_date","lock_to_date","reason_text","external_ref_id"]);
        this.error=!Object.keys(error.fieldErrors).length||hasUnmappedValidation(error.fieldErrors,field=>inlineFields.has(field))?error.message:"";
      } else this.error=error instanceof Error ? error.message : "Failed to create transaction lock";
    }
    finally { this.acting=false; }
  }

  private async act(action: "release"|"reactivate"|"void"|"level"): Promise<void> {
    if(!this.selected) return;
    const reason=window.prompt(`Reason for ${action === "level" ? "changing the lock level" : action} (minimum 5 characters)`);
    if(!reason) return;
    this.acting=true; this.error="";
    try {
      const api=getEmbedClient().transactionLocks;
      if(action === "level") await api.setLevel(this.selected.id,this.selected.lock_level === "HARD" ? "SOFT" : "HARD",reason);
      else await api[action](this.selected.id,reason);
      this.selected=null; await this.load();
    } catch(error) { this.error=error instanceof Error ? error.message : "Lock action failed"; }
    finally { this.acting=false; }
  }

  private renderForm() { return html`<form class="panel" @submit=${this.createLock}>
    <div class="panel-head"><div><h3>New transaction lock</h3><span>Restrict accounting changes for a defined period.</span></div><button class="secondary" type="button" @click=${()=>this.showForm=false}>Close</button></div>
    <div class="form-grid">
      <label class="wide">Lock name<input aria-invalid=${this.errorsFor("lock_label").length?"true":"false"} required minlength="3" maxlength="200" .value=${this.form.lock_label} @input=${(e:Event)=>this.updateForm("lock_label",e)} />${this.fieldFeedback("lock_label")}</label>
      <label>Scope<select aria-invalid=${this.errorsFor("module_scope").length?"true":"false"} .value=${this.form.module_scope} @change=${(e:Event)=>this.updateForm("module_scope",e)}><option>GLOBAL</option><option>GL</option><option>SALES</option><option>PURCHASES</option></select>${this.fieldFeedback("module_scope")}</label>
      <label>Lock level<select aria-invalid=${this.errorsFor("lock_level").length?"true":"false"} .value=${this.form.lock_level} @change=${(e:Event)=>this.updateForm("lock_level",e)}><option>SOFT</option><option>HARD</option></select>${this.fieldFeedback("lock_level")}</label>
      <label>From<input aria-invalid=${this.errorsFor("lock_from_date").length?"true":"false"} required type="date" .value=${this.form.lock_from_date} @input=${(e:Event)=>this.updateForm("lock_from_date",e)} />${this.fieldFeedback("lock_from_date")}</label>
      <label>To<input aria-invalid=${this.errorsFor("lock_to_date").length?"true":"false"} type="date" min=${this.form.lock_from_date} .value=${this.form.lock_to_date ?? ""} @input=${(e:Event)=>this.updateForm("lock_to_date",e)} />${this.fieldFeedback("lock_to_date")}</label>
      <label class="wide">Reason<textarea aria-invalid=${this.errorsFor("reason_text").length?"true":"false"} required minlength="3" maxlength="200" .value=${this.form.reason_text} @input=${(e:Event)=>this.updateForm("reason_text",e)}></textarea>${this.fieldFeedback("reason_text")}</label>
      <label>Reference<input aria-invalid=${this.errorsFor("external_ref_id").length?"true":"false"} .value=${this.form.external_ref_id ?? ""} @input=${(e:Event)=>this.updateForm("external_ref_id",e)} />${this.fieldFeedback("external_ref_id")}</label>
    </div><div class="form-actions"><button class="primary" type="submit" ?disabled=${this.acting}>${this.acting?"Creating…":"Create lock"}</button></div>
  </form>`; }

  private renderDetail() { const row=this.selected!; return html`<section class="panel">
    <div class="panel-head"><div><h3>${row.lock_label}</h3><span>${row.lock_identifier || "Transaction lock"}</span></div><button class="secondary" @click=${()=>this.selected=null}>Close</button></div>
    <div class="detail-grid"><div class="datum"><span>Level</span><strong>${row.lock_level}</strong></div><div class="datum"><span>Scope</span><strong>${row.module_scope}</strong></div><div class="datum"><span>Period</span><strong>${row.lock_from_date} — ${row.lock_to_date || "Open-ended"}</strong></div><div class="datum"><span>Status</span><strong>${row.status}</strong></div><div class="datum reason"><span>Reason</span><strong>${row.reason_text || "—"}</strong></div></div>
    <div class="form-actions">${row.status === "ACTIVE" ? html`<button class="secondary" ?disabled=${this.acting} @click=${()=>this.act("level")}>Make ${row.lock_level === "HARD" ? "soft" : "hard"}</button><button class="secondary" ?disabled=${this.acting} @click=${()=>this.act("release")}>Release</button><button class="secondary" ?disabled=${this.acting} @click=${()=>this.act("void")}>Void</button>` : html`<button class="primary" ?disabled=${this.acting} @click=${()=>this.act("reactivate")}>Reactivate</button>`}</div>
  </section>`; }

  render() { return html`<div class="toolbar"><div class="intro"><strong>Transaction locks</strong><span>Control changes to closed or reviewed accounting periods.</span></div><button class="primary" @click=${()=>{this.selected=null;this.showForm=true}}>New lock</button></div>
    <div class="filters">${(["ACTIVE","RELEASED","ALL"] as StatusFilter[]).map(value=>html`<button class="secondary" aria-pressed=${this.status===value} @click=${()=>{this.status=value;void this.load()}}>${value[0]+value.slice(1).toLowerCase()}</button>`)}</div>
    ${this.error?html`<div class="error">${this.error}</div>`:nothing}${this.success?html`<div class="ledger-success" role="status">${this.success}</div>`:nothing}${this.showForm?this.renderForm():nothing}${this.selected?this.renderDetail():nothing}
    ${this.loading?html`<div class="state-loading">Loading transaction locks…</div>`:html`<div class="ledger-table-wrap"><table class="lock-table"><thead><tr><th>Lock</th><th>Scope</th><th>Period</th><th>Level</th><th>Status</th></tr></thead><tbody>${this.rows.length?this.rows.map(row=>html`<tr @click=${()=>this.selected=row}><td><strong>${row.lock_label}</strong><br><small>${row.lock_identifier || row.external_ref_id || "—"}</small></td><td>${row.module_scope}</td><td>${row.lock_from_date}<br><small>to ${row.lock_to_date || "open-ended"}</small></td><td><span class="level ${row.lock_level.toLowerCase()}">${row.lock_level}</span></td><td><span class="status ${row.status.toLowerCase()}">${row.status}</span></td></tr>`):html`<tr><td colspan="5" class="ledger-empty">No transaction locks found.</td></tr>`}</tbody></table></div>`}`; }
}

declare global { interface HTMLElementTagNameMap { "paprel-transaction-locks": PaprelTransactionLocks; } }
