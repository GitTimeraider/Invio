<script lang="ts">
  import { getContext } from "svelte";
  import { FileText, Download, ArrowLeft, MoreHorizontal, FileCode2, Send, Ban, Trash2, CheckCircle, Check, Pencil, ChevronDown, Mail, Copy } from "lucide-svelte";
  import { enhance } from "$app/forms";
  import { page } from "$app/state";
  import type { SubmitFunction } from "@sveltejs/kit";

  import { hasPermission } from "$lib/types";
  import { formatPostalCityLine } from "$lib/address";

  let { data, form } = $props();
  let t = getContext("i18n") as (key: string) => string;
  const getLoc = getContext("localization") as () => any;

  let invoice = $derived(data.invoice);
  let user = $derived(data.user);

  let isOverdue = $derived.by(() => {
    if (!invoice) return false;
    if (invoice.status === "paid" || invoice.status === "voided") return false;
    const due = invoice.dueDate ? new Date(invoice.dueDate as string) : null;
    if (!due) return false;
    const today = new Date();
    const dueDateObj = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayObj = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dueDateObj.valueOf() < todayObj.valueOf();
  });

  let canUpdate = $derived(hasPermission(user, "invoices", "update"));
  let canDelete = $derived(hasPermission(user, "invoices", "delete"));
  let canVoid = $derived(hasPermission(user, "invoices", "void"));
  let allowProtectedInvoiceChanges = $derived(Boolean(data.allowProtectedInvoiceChanges));
  let isRetentionProtectedInvoice = $derived(invoice?.status === "sent" || invoice?.status === "paid" || invoice?.status === "complete" || invoice?.status === "overdue");
  let canEditInvoice = $derived(canUpdate && Boolean(invoice && (invoice.status === "draft" || (allowProtectedInvoiceChanges && invoice.status !== "voided"))));
  let canDeleteInvoice = $derived(canDelete && Boolean(invoice && (invoice.status === "draft" || invoice.status === "voided" || (allowProtectedInvoiceChanges && invoice.status !== "voided"))));

  let paidPaymentMethod = $state("");
  let emailSending = $state(false);
  let emailDialog: HTMLDialogElement;
  let selectedEmailAttachments = $state<File[]>([]);

  let emailEnabled = $derived(Boolean(data.emailEnabled));
  let canExport = $derived(hasPermission(user, "invoices", "export"));

  type EmailConfig = {
    id: string;
    name: string;
    fromAddress: string;
    defaultSubject: string | null;
    defaultBody: string | null;
    reminderSubject: string | null;
    reminderBody: string | null;
  };
  let emailConfigs = $derived((data as any).emailConfigs as EmailConfig[] ?? []);
  let selectedEmailConfigId = $state<string>((data as any).defaultEmailConfigId ?? "");
  let useReminderEmail = $derived(invoice?.status === "sent" || invoice?.status === "overdue");
  let isResendEmail = $derived(invoice?.status === "paid");
  let emailDialogTitle = $derived(useReminderEmail ? t("Send Reminder") : isResendEmail ? t("Resend via Email") : t("Send via Email"));
  let emailSubmitLabel = $derived(useReminderEmail ? t("Send Reminder") : isResendEmail ? t("Resend") : t("Send"));

  // When configs load or change, default to configured sender or first config
  $effect(() => {
    const configs = emailConfigs;
    const preferred = (data as any).defaultEmailConfigId || configs[0]?.id || "";
    if (!selectedEmailConfigId || !configs.some((cfg) => cfg.id === selectedEmailConfigId)) {
      selectedEmailConfigId = preferred;
    }
  });

  let selectedEmailConfig = $derived(
    emailConfigs.find((c) => c.id === selectedEmailConfigId) ?? null
  );

  let defaultEmailSubject = $derived(
    useReminderEmail
      ? (selectedEmailConfig?.reminderSubject || selectedEmailConfig?.defaultSubject || (invoice ? `Reminder: Invoice #${invoice.invoiceNumber || invoice.id}` : "Reminder"))
      : (selectedEmailConfig?.defaultSubject || (invoice ? `Invoice #${invoice.invoiceNumber || invoice.id}` : "Invoice")),
  );
  let defaultEmailBody = $derived(
    useReminderEmail
      ? (selectedEmailConfig?.reminderBody ?? selectedEmailConfig?.defaultBody ?? "")
      : (selectedEmailConfig?.defaultBody ?? "")
  );
  let defaultEmailTo = $derived(
    invoice?.customer?.paymentEmail ?? invoice?.customer?.email ?? "",
  );

  $effect(() => {
    if ((form as any)?.emailSent) {
      emailDialog?.close();
    }
  });

  function openEmailModal() {
    emailDialog?.showModal();
  }

  let revealedEmailLogIds = $state<Set<string>>(new Set());

  function revealEmailLogRecipients(id: string) {
    revealedEmailLogIds = new Set(revealedEmailLogIds).add(id);
  }

  function hideEmailLogRecipients(id: string) {
    const next = new Set(revealedEmailLogIds);
    next.delete(id);
    revealedEmailLogIds = next;
  }

  function maskEmailAddress(address: string): string {
    const at = address.indexOf("@");
    if (at <= 0) return "•••••";
    const local = address.slice(0, at);
    const domain = address.slice(at + 1);
    const maskedLocal = local.length <= 2 ? local[0] + "•" : local[0] + "•".repeat(Math.min(local.length - 2, 6)) + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  }

  function maskRecipients(recipients: string[]): string {
    return recipients.map(maskEmailAddress).join(", ");
  }

  function onEmailAttachmentsChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    selectedEmailAttachments = input.files ? Array.from(input.files) : [];
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fmtDate(d?: string | Date) {
    if (!d) return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return "";
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    if (getLoc()?.dateFormat === "DD.MM.YYYY") {
      return `${day}.${month}.${year}`;
    }
    return `${year}-${month}-${day}`;
  }

  function fmtMoney(v?: number) {
    return `${Number(v || 0).toFixed(2)} ${invoice?.currency || "EUR"}`;
  }

  function fmtDateTime(d: Date) {
    if (!d || Number.isNaN(d.getTime())) return "";
    const date = fmtDate(d);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${date} ${h}:${m}`;
  }

  function confirmAction(message: string | (() => string)): SubmitFunction {
    return ({ cancel }) => {
      const text = typeof message === "function" ? message() : message;
      if (!confirm(text)) cancel();
    };
  }

  function confirmEditNavigation(event: MouseEvent) {
    if (!allowProtectedInvoiceChanges || !isRetentionProtectedInvoice) return;
    if (!confirm(t("You are about to edit a sent/paid/complete invoice. Ensure this is legally allowed in your jurisdiction. Continue?"))) {
      event.preventDefault();
    }
  }
</script>

<!-- Send via Email dialog -->
<dialog bind:this={emailDialog} class="modal">
  <div class="modal-box max-w-lg">
    <form method="dialog">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-3 top-3">✕</button>
    </form>
    <h3 class="mb-4 text-lg font-semibold">{emailDialogTitle}</h3>

      {#if (form as any)?.emailError}
        <div class="alert alert-error mb-4 text-sm">
          <span>{(form as any).emailError}</span>
        </div>
      {/if}

      <form
        method="post"
        enctype="multipart/form-data"
        use:enhance={() => {
          emailSending = true;
          return async ({ result, update }) => {
            await update({ reset: false });
            emailSending = false;
            if (result.type === "success") {
              selectedEmailAttachments = [];
              emailDialog?.close();
            }
          };
        }}
      >
        <input type="hidden" name="intent" value="send-email" />
        <input type="hidden" name="emailConfigId" value={selectedEmailConfigId} />

        {#if emailConfigs.length > 0}
          <div class="form-control mb-3">
            <label class="label pb-1" for="emailConfigSelect">
              <span class="label-text font-medium">{t("Send from")}</span>
            </label>
            <select
              id="emailConfigSelect"
              class="select select-bordered w-full"
              bind:value={selectedEmailConfigId}
              disabled={emailSending}
            >
              {#each emailConfigs as cfg (cfg.id)}
                <option value={cfg.id}>{cfg.name} ({cfg.fromAddress})</option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="form-control mb-3">
          <label class="label pb-1" for="emailTo">
            <span class="label-text font-medium">{t("To")}</span>
            <span class="label-text-alt opacity-60">{t("Separate multiple with commas")}</span>
          </label>
          <input
            id="emailTo"
            type="text"
            name="emailTo"
            class="input input-bordered w-full"
            value={defaultEmailTo}
            placeholder="customer@example.com, other@example.com"
            disabled={emailSending}
            required
          />
        </div>

        <div class="form-control mb-3">
          <label class="label pb-1" for="emailSubject">
            <span class="label-text font-medium">{t("Subject")}</span>
          </label>
          <input
            id="emailSubject"
            type="text"
            name="emailSubject"
            class="input input-bordered w-full"
            value={defaultEmailSubject}
            disabled={emailSending}
            required
          />
        </div>

        <div class="form-control mb-4">
          <label class="label pb-1" for="emailMessage">
            <span class="label-text font-medium">{t("Message")}</span>
            <span class="label-text-alt opacity-60">{t("Optional")}</span>
          </label>
          <textarea
            id="emailMessage"
            name="emailMessage"
            class="textarea textarea-bordered w-full"
            rows="4"
            placeholder={t("Add a personal note...")}
            disabled={emailSending}
          >{defaultEmailBody}</textarea>
        </div>

        <div class="text-base-content/60 mb-4 flex items-center gap-2 text-sm">
          <FileText size={14} />
          <span>{t("The invoice PDF will be attached automatically.")}</span>
        </div>

        <div class="form-control mb-4">
          <label class="label pb-1" for="emailAttachments">
            <span class="label-text font-medium">{t("Additional attachments")}</span>
            <span class="label-text-alt opacity-60">{t("Optional")}</span>
          </label>
          <input
            id="emailAttachments"
            type="file"
            name="attachments"
            class="file-input file-input-bordered w-full"
            multiple
            disabled={emailSending}
            onchange={onEmailAttachmentsChange}
          />
          {#if selectedEmailAttachments.length > 0}
            <div class="bg-base-200/60 mt-2 rounded-lg px-3 py-2 text-xs">
              <p class="mb-1 font-medium">{selectedEmailAttachments.length} {t("file(s) selected")}</p>
              <ul class="space-y-1 opacity-80">
                {#each selectedEmailAttachments as file (file.name + file.size)}
                  <li class="truncate">{file.name} ({formatFileSize(file.size)})</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>

        <div class="modal-action mt-0">
          <button type="button" class="btn btn-ghost" disabled={emailSending} onclick={() => emailDialog?.close()}>{t("Cancel")}</button>
          <button type="submit" class="btn btn-primary" disabled={emailSending}>
            {#if emailSending}
              <span class="loading loading-spinner loading-sm"></span>
            {:else}
              <Mail size={16} />
            {/if}
            {emailSubmitLabel}
          </button>
        </div>
      </form>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>

<div class="mb-6">
  {#if form?.error}
    <div class="alert alert-error mb-4 text-sm shadow sm:text-base">
      <div class="flex-1 overflow-hidden">
        <div class="font-medium">{form.error}</div>
      </div>
    </div>
  {/if}

  {#if (form as any)?.emailSent}
    <div class="alert alert-success mb-4 text-sm shadow sm:text-base">
      <CheckCircle size={18} />
      <div class="flex-1">
        <div class="font-medium">{useReminderEmail ? t("Reminder sent successfully") : t("Invoice sent successfully")}</div>
        <div class="opacity-80">{t("Sent to")} {(form as any).emailRecipients?.join(", ")}</div>
        <div class="opacity-70 text-xs">{t("Sender source")}: {(form as any).emailSource}</div>
      </div>
    </div>
  {/if}

  <div class="border-base-200 flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
    <div class="flex items-center gap-3">
      <a href="/invoices" class="btn btn-ghost btn-circle btn-sm">
        <ArrowLeft size={20} />
      </a>
      <h1 class="flex items-center gap-2 text-2xl font-semibold">
        {t("Invoice #")}
        {invoice?.invoiceNumber || invoice?.id}
      </h1>
      {#if invoice?.status}
        <span
          class="badge {invoice.status === 'paid'
            ? 'badge-success'
            : invoice.status === 'complete'
              ? 'badge-secondary'
              : invoice.status === 'voided'
                ? 'badge-warning'
                : isOverdue && invoice?.status !== 'paid' && invoice?.status !== 'complete'
                  ? 'badge-error'
                  : invoice.status === 'sent'
                    ? 'badge-info'
                    : ''}"
        >
          {invoice.status === "voided"
            ? t("Voided")
            : invoice.status === "complete"
              ? t("Complete")
              : isOverdue && invoice?.status !== "paid" && invoice?.status !== "complete"
                ? t("Overdue")
                : t(invoice?.status === "draft" ? "Draft" : invoice?.status === "sent" ? "Sent" : invoice?.status === "paid" ? "Paid" : "Overdue")}
        </span>
      {/if}
    </div>

    <!-- Hidden forms for dropdown actions -->
    <form id="inv-duplicate" method="post" class="hidden" use:enhance>
      <input type="hidden" name="intent" value="duplicate" />
    </form>
    <form id="inv-mark-sent" method="post" class="hidden" use:enhance>
      <input type="hidden" name="intent" value="mark-sent" />
    </form>
    <form id="inv-mark-complete" method="post" class="hidden" use:enhance>
      <input type="hidden" name="intent" value="mark-complete" />
    </form>
    <form id="inv-void" method="post" class="hidden" use:enhance={confirmAction(t("Void this invoice?"))}>
      <input type="hidden" name="intent" value="void" />
    </form>
    <form
      id="inv-delete"
      method="post"
      class="hidden"
      use:enhance={confirmAction(() =>
        isRetentionProtectedInvoice
          ? t("You are about to delete a sent/paid/complete invoice. This may violate invoice retention laws and cannot be undone. Continue?")
          : t("Delete this invoice? This cannot be undone."),
      )}
    >
      <input type="hidden" name="intent" value="delete" />
    </form>

    {#if invoice}
      <div class="flex flex-wrap items-center gap-2">
        {#if canEditInvoice}
          <a href="/invoices/{invoice.id}/edit" class="btn btn-sm" onclick={confirmEditNavigation}>
            <Pencil size={16} />
            <span class="hidden sm:inline">{t("Edit")}</span>
          </a>
        {/if}

        {#if invoice.status === "paid" && canUpdate}
          <form method="post" use:enhance>
            <input type="hidden" name="intent" value="mark-complete" />
            <button type="submit" class="btn btn-sm btn-secondary" title={t("Mark as Complete")}>
              <CheckCircle size={16} />
              <span class="hidden sm:inline">{t("Mark as Complete")}</span>
            </button>
          </form>
        {/if}

        {#if (invoice.status === "sent" || invoice.status === "overdue") && canUpdate}
          <div class="join">
            <form method="post" use:enhance>
              <input type="hidden" name="intent" value="mark-paid" />
              <button type="submit" class="btn btn-sm btn-primary join-item" title={t("Mark as Paid")}>
                <Check size={16} />
                <span class="hidden sm:inline">{t("Mark as Paid")}</span>
              </button>
            </form>
            <div class="dropdown dropdown-end">
              <button tabindex="0" type="button" class="btn btn-sm btn-primary join-item border-l-primary-content/20 border-l px-2">
                <ChevronDown size={14} />
              </button>
              <div tabindex="0" class="dropdown-content bg-base-100 rounded-box border-base-200 z-10 mt-1 w-60 space-y-2 border p-3 shadow">
                <p class="text-sm font-medium opacity-70">{t("Payment Method")}</p>
                <form method="post" use:enhance>
                  <input type="hidden" name="intent" value="mark-paid" />
                  <input
                    class="input input-bordered input-sm w-full"
                    type="text"
                    name="paymentMethod"
                    bind:value={paidPaymentMethod}
                    placeholder={t("e.g. Bank Transfer, PayPal")}
                    autocomplete="off"
                  />
                  <div class="flex flex-wrap gap-1 pt-2">
                    {#each ["Bank Transfer", "PayPal", "Cash", "Credit Card", "Stripe"] as method (method)}
                      <button type="button" class="badge badge-outline hover:badge-primary cursor-pointer text-xs" onclick={() => (paidPaymentMethod = method)}>
                        {method}
                      </button>
                    {/each}
                  </div>
                  <button type="submit" class="btn btn-primary btn-sm btn-block mt-2">{t("Mark as Paid")}</button>
                </form>
              </div>
            </div>
          </div>
        {/if}

        {#if emailEnabled && canExport && (invoice.status === "draft" || invoice.status === "sent" || invoice.status === "overdue" || invoice.status === "paid")}
          <button type="button" class="btn btn-sm" onclick={openEmailModal}>
            <Mail size={16} />
            <span class="hidden sm:inline">{emailDialogTitle}</span>
          </button>
        {/if}

        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-ghost btn-sm">
            <MoreHorizontal size={16} />
            <span class="hidden sm:inline">{t("More")}</span>
          </div>
          <ul tabindex="-1" class="menu menu-sm dropdown-content bg-base-100 rounded-box border-base-200 z-1 mt-2 w-56 border p-2 shadow">
            <li>
              <button type="submit" form="inv-duplicate" class="flex items-center gap-2 py-2">
                <Copy size={16} />
                {t("Duplicate")}
              </button>
            </li>
            <li>
              <a href="/api/v1/invoices/{invoice.id}/xml" target="_blank" title={t("Download XML")} class="flex items-center gap-2 py-2">
                <FileText size={16} />
                {t("Download XML")}
              </a>
            </li>
            <div class="divider my-0 py-0"></div>
            {#if invoice.status === "paid" && canUpdate}
              <li>
                <button type="submit" form="inv-mark-complete" class="flex items-center gap-2 py-2">
                  <CheckCircle size={16} />
                  {t("Mark as Complete")}
                </button>
              </li>
            {/if}
            {#if invoice.status === "draft" && canUpdate}
              <li>
                <button type="submit" form="inv-mark-sent" class="flex items-center gap-2 py-2">
                  <Send size={16} />
                  {t("Mark as Sent")}
                </button>
              </li>
            {/if}
            {#if (invoice.status === "sent" || invoice.status === "overdue") && canVoid}
              <li>
                <button type="submit" form="inv-void" class="text-warning flex items-center gap-2 py-2">
                  <Ban size={16} />
                  {t("Void Invoice")}
                </button>
              </li>
            {/if}
            {#if canDeleteInvoice}
              <li>
                <button type="submit" form="inv-delete" class="text-error flex items-center gap-2 py-2">
                  <Trash2 size={16} />
                  {t("Delete")}
                </button>
              </li>
            {/if}
          </ul>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if invoice}
  <div class="mt-6 mb-8 grid grid-cols-1 gap-x-8 gap-y-4 text-sm md:grid-cols-2">
    <div class="space-y-4">
      <div>
        <span class="mr-1 opacity-70">{t("Customer")}:</span>
        {invoice.customer?.name || t("Unknown Customer")}
      </div>
      <div class="flex gap-1">
        <span class="mr-1 opacity-70">{t("Address")}:</span>
        <div class="whitespace-pre-line">
          {#if invoice.customer?.address || invoice.customer?.city}
            {[invoice.customer?.address, formatPostalCityLine(invoice.customer?.city, invoice.customer?.postalCode, invoice.customer?.countryCode, getLoc()?.postalCityFormat)]
              .filter(Boolean)
              .join("\n")}
          {/if}
        </div>
      </div>
      <div>
        <span class="mr-1 opacity-70">{t("Issue Date")}:</span>
        {fmtDate(invoice.issueDate) || "-"}
      </div>
      <div class="mt-4">
        <span class="mr-1 opacity-70">{t("Subtotal")}:</span>
        {fmtMoney(invoice.subtotal)}
      </div>

      <div class="flex flex-wrap gap-1 text-xs opacity-60">
        {#if invoice.taxes?.length}
          {t("Prices include tax")}: {invoice.pricesIncludeTax ? t("Yes") : t("No")} -
          {t("Rounding")}: {t("Round per line")} -
          {t("Tax mode")}: {t("Per line")}
        {:else}
          {t("Tax rate")}: {invoice.taxRate}% -
          {t("Prices include tax")}: {invoice.pricesIncludeTax ? t("Yes") : t("No")} -
          {t("Rounding")}: {t("Round per line")} -
          {t("Tax mode")}: {t("Invoice total")}
        {/if}
      </div>

      <div class="mt-4">
        <span class="mr-1 opacity-70">{t("Total")}:</span>
        <span class="font-bold">{fmtMoney(invoice.total)}</span>
      </div>
      <div>
        <span class="mr-1 opacity-70">{t("Payment Terms")}:</span>
        <span class="font-medium">{invoice.paymentTerms || "-"}</span>
      </div>

      <div class="pt-2 opacity-70">
        {invoice.items?.length || 0}
        {t("item(s)")}
      </div>

      <div class="flex flex-wrap gap-2 pt-4">
        <a class="btn btn-sm btn-outline" href="/api/v1/invoices/{invoice.id}/html" target="_blank">
          <FileCode2 size={16} />
          {t("View HTML")}
        </a>
        <a class="btn btn-sm btn-primary" href="/api/v1/invoices/{invoice.id}/pdf" target="_blank">
          <Download size={16} />
          {t("Download PDF")}
        </a>
      </div>
    </div>

    <div class="space-y-4">
      <div>
        <span class="mr-1 opacity-70">{t("Email")}:</span>
        {invoice.customer?.email || ""}
      </div>
      <div class="mt-4">
        <span class="mr-1 opacity-70">{t("Due Date")}:</span>
        {fmtDate(invoice.dueDate) || "-"}
      </div>
      <div>
        <span class="mr-1 opacity-70">{t("Tax")}:</span>
        {fmtMoney(invoice.taxAmount)}
      </div>
      <div>
        <span class="mr-1 opacity-70">{t("Discount")}:</span>
        {fmtMoney(invoice.discountAmount)}
      </div>
    </div>
  </div>

  {#if invoice.items && invoice.items.length > 0}
    <div class="mt-8">
      <div class="bg-base-100 rounded-box border-base-200 overflow-hidden border shadow-sm">
        <table class="table-sm sm:table-md table w-full">
          <thead class="bg-base-200/50">
            <tr>
              <th>{t("Description")}</th>
              <th class="text-right">{t("Qty")}</th>
              <th class="text-right">{t("Price")}</th>
              <th class="text-right">{t("Total")}</th>
            </tr>
          </thead>
          <tbody>
            {#each invoice.items as item (item.id)}
              <tr>
                <td class="whitespace-pre-wrap">{item.description || t("Item")}</td>
                <td class="text-right">{item.quantity}</td>
                <td class="text-right">{fmtMoney(item.unitPrice)}</td>
                <td class="text-right font-medium">{fmtMoney(item.quantity * item.unitPrice)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if invoice.statusHistory && invoice.statusHistory.length > 0}
    <div class="mt-8">
      <h2 class="mb-3 text-base font-semibold opacity-70">{t("Status History")}</h2>
      <ul class="border-base-300 space-y-4 border-l-2 pl-4">
        {#each invoice.statusHistory as entry (entry.id)}
          <li class="relative">
            <span class="bg-base-300 border-base-100 absolute top-1 -left-[1.3rem] h-3 w-3 rounded-full border-2"></span>
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="badge badge-sm {entry.status === 'paid'
                  ? 'badge-success'
                  : entry.status === 'voided'
                    ? 'badge-warning'
                    : entry.status === 'complete'
                      ? 'badge-secondary'
                      : entry.status === 'sent'
                        ? 'badge-info'
                        : 'badge-ghost'}"
              >
                {t(entry.status.charAt(0).toUpperCase() + entry.status.slice(1))}
              </span>
              <span class="text-sm opacity-60">{fmtDateTime(new Date(entry.changedAt))}</span>
              {#if entry.paymentMethod}
                <span class="text-sm opacity-80">· {entry.paymentMethod}</span>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if invoice.emailLogs && invoice.emailLogs.length > 0}
    <div class="mt-8">
      <h2 class="mb-3 text-base font-semibold opacity-70">{t("Email Log")}</h2>
      <ul class="border-base-300 space-y-4 border-l-2 pl-4">
        {#each invoice.emailLogs as entry (entry.id)}
          <li class="relative">
            <span
              class="absolute top-1 -left-[1.3rem] h-3 w-3 rounded-full border-2 border-base-100 {entry.success
                ? 'bg-success'
                : 'bg-error'}"
            ></span>
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge badge-sm {entry.mode === 'reminder' ? 'badge-warning' : 'badge-info'}">
                {entry.mode === "reminder" ? t("Reminder") : t("Invoice Email")}
              </span>
              {#if !entry.success}
                <span class="badge badge-sm badge-error">{t("Failed")}</span>
              {/if}
              <span class="text-sm opacity-60">{fmtDateTime(new Date(entry.sentAt))}</span>
            </div>
            <div class="mt-1 text-sm">
              <span class="opacity-70">{t("To")}:</span>
              {#if revealedEmailLogIds.has(entry.id)}
                <span class="font-medium">{entry.recipients.join(", ")}</span>
                <button
                  type="button"
                  class="link link-hover ml-2 text-xs opacity-60"
                  onclick={() => hideEmailLogRecipients(entry.id)}
                >
                  {t("Hide")}
                </button>
              {:else}
                <button
                  type="button"
                  class="link link-hover font-medium"
                  onclick={() => revealEmailLogRecipients(entry.id)}
                >
                  {maskRecipients(entry.recipients)}
                </button>
              {/if}
            </div>
            {#if entry.subject}
              <div class="text-xs opacity-60">{entry.subject}</div>
            {/if}
            {#if !entry.success && entry.error}
              <div class="text-error mt-1 text-xs">{entry.error}</div>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
{/if}

