# InvoiceRaider

<p align="center" width="100%">
    <img width="33%" src="https://github.com/GitTimeraider/Assets/blob/main/InvoiceRaider/img/invoiceraider_icon.png">
</p>

<details>
  <summary>Open for sort of CHANGELOGS?</summary>

**V1.04 - Mail additions**
- From mail field can now be used to send mail from other aliases (as long as its within the same domain as the SMTP account has access to
- Paid status now has the option to also send mail to allow for sending mails to Paperless-ngx or other software for archiving
- A new email config setting has been added which enables the usage of the FROM field within the email. To be precise, when turned on it replaces your company email address with the FROM address of the email config selected. This allows for you to send mails to customers ujsing customer-specific mailaddresses which then automatically get added to our invoice based on the mailconfig used.
- Removed the status line from the invoice when it is in Draft status. As this is mostly the status it is in the moment you send or save the invoice to get it to customers, the status is not needed. All other statusses do show in the invoice as they contribute to making sure the customer or archiving systems understand the status of the invoice when its not "normal"

**V1.03 - Mail configs**
- Addition of mail configs in the settings menu
- Addition of using mail configs to send out invoices by mail to customers or archiving purposes
- Addition of using mail configs to send out reminders/overdue warnings by mail
- Addition of logging per invoice on when and to who mail has been sent

**V1.02 - Dashboard refresh**
- Addition of an improved dashboard with clickable elements

**V1.01 - Initial QoL**
- Alligned specific settings within the page view
- Fixed the way VAT is shown and calculated in the invoices allow it to switch correctly even when switching between products that have different VATs
- Addition of an extra customer and company field to add country-specific company registration numbers
- Changes addresses to be one-liners which might annoy some but in my eyes looks cleaner and is better proportional in a lot of situations
- Allowed for things like whitelines/enters to work in most text blocks
- More minor things

</details>


Formerly a fork of https://github.com/kittendevv/Invio, however at this point enough functionality has been added and removed to make it its own project.
No changes made in the Invio project will be introduced in here anymore and it will go its own way.

### Disclaimers: 
#### AI is responsible for over half of the coding. Also keep in mind that this software is mostly developed for personal use by myself and thus might not receive all feature requests desired.
################################################################

A modern, self-hosted invoice management platform for freelancers and small to medium-sized businesses. Built with a SvelteKit frontend and a Deno/Hono backend, packaged as a single Docker container.

---


<details>
  <summary>📸 Click to show screenshots</summary>

  ![Dashboard](https://github.com/GitTimeraider/Assets/blob/main/InvoiceRaider/img/dashboard.png)
  ![Invoice](https://github.com/GitTimeraider/Assets/blob/main/InvoiceRaider/img/invoice.png)
  ![Customer](https://github.com/GitTimeraider/Assets/blob/main/InvoiceRaider/img/customer.png)
  ![Mail](https://github.com/GitTimeraider/Assets/blob/main/InvoiceRaider/img/mail.png)

</details>


## Features

- **Invoice Management** — Create, edit, and track invoices with draft/sent/paid/overdue/voided statuses and direct email delivery
- **Customer Database** — Store contact info, tax IDs, company details, and country codes
- **Product Catalog** — Define products and services with pricing, units, SKUs, and tax categories
- **Template Engine** — Multiple built-in templates (Professional Modern, Minimalist Clean, Slate, Nova) with custom upload support
- **Export Formats** — PDF, UBL 2.1, Factur-X (ZugFeRD), FatturaPA, and PEPPOL-compatible XML
- **Multi-User & Permissions** — Role-based access control with a fine-grained resource/action permission matrix
- **Two-Factor Authentication** — TOTP (authenticator app) with recovery codes
- **OpenID Connect** — Optional OIDC integration for SSO
- **Email Sending** — Send invoices via SMTP with PDF attachments; supports multiple email configurations, per-config normal/reminder templates, and status-aware reminder emails
- **Multi-Currency & Tax** — Per-invoice currency, per-line tax rates, inclusive/exclusive pricing, flexible rounding
- **Themes** — Light and dark themes via daisyUI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit 2, Vite 8, Tailwind CSS 4, daisyUI 5 |
| Frontend runtime | Bun |
| Backend | Deno 2 + Hono 4 |
| Database | SQLite 3 (via Deno) |
| PDF generation | WeasyPrint |
| Auth | JWT + TOTP |
| Packaging | Docker + Supervisord |

---

## Quick Start (Docker Compose)

```yaml
# docker-compose.yml
services:
  invoiceraider:
    image: ghcr.io/gittimeraider/invoiceraider:latest
    ports:
      - "8000:8000"
    volumes:
      - invoiceraider_data:/app/data
    environment:
      JWT_SECRET: change-me-to-a-long-random-string
      ADMIN_USER: admin
      ADMIN_PASS: changeme

volumes:
  invoiceraider_data:
```

```bash
docker compose up -d
```

Then open [http://localhost:8000](http://localhost:8000) and log in with your configured admin credentials.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | Yes | — | Secret key for signing JWTs |
| `ADMIN_USER` | Yes | — | Initial admin username |
| `ADMIN_PASS` | Yes | — | Initial admin password |
| `BACKEND_PORT` / `PORT` | No | `3000` | Internal backend port |
| `SESSION_TTL_SECONDS` | No | `3600` | JWT session lifetime (300–43200 s) |
| `SECURE_HEADERS_DISABLED` | No | `false` | Disable security headers (not recommended) |
| `ENABLE_HSTS` | No | `false` | Send HSTS header (enable when behind HTTPS) |
| `CONTENT_SECURITY_POLICY` | No | built-in | Override the default CSP header |

---

## Data Persistence

All application data is stored under `/app/data/` inside the container:

| Path | Contents |
|---|---|
| `/app/data/app.db` | SQLite database |
| `/app/data/logos/` | Company logo uploads |
| `/app/data/templates/` | Custom invoice templates |
| `/app/data/backups/` | Automatic DB backups on schema upgrade |

Mount a named volume at `/app/data` to persist data across container restarts.

---

## Invoice Number Patterns

Invoice numbers can be customized in Settings using token placeholders:

| Token | Description |
|---|---|
| `{YYYY}` | Full year (e.g. 2025) |
| `{MM}` | Two-digit month |
| `{DD}` | Two-digit day |
| `{RAND4}` | 4-character random alphanumeric |

Example: `INV-{YYYY}-{MM}-{RAND4}` → `INV-2025-06-A3F9`

---

## Export Formats

| Format | Standard | Use Case |
|---|---|---|
| PDF | — | Universal; uses WeasyPrint for rendering |
| UBL 2.1 | OASIS | General B2B electronic invoicing |
| Factur-X / ZugFeRD | EN 16931 | German/French hybrid PDF+XML |
| FatturaPA | Italian SDI | Italian electronic invoicing |
| PEPPOL BIS 3.0 | OpenPEPPOL | Pan-European procurement network |

---

## Email Actions by Invoice Status

InvoiceRaider exposes email actions in the invoice detail view based on invoice status:

- **Draft** — Shows **Send via Email**
- **Paid** — Shows **Resend via Email**
- **Sent** and **Overdue** — Shows **Send Reminder**
- **Complete** and **Voided** — No email button; these statuses are final and cannot be emailed.


Each email configuration can define separate templates for:

- **Normal invoice emails** — Default Subject and Default Body
- **Reminder emails** — Reminder Subject and Reminder Body

When a reminder template is not set for a config, InvoiceRaider falls back to that same config's normal Subject/Body.

This behavior helps separate first-send emails from follow-up reminders while still keeping a safe fallback.

The company email shown on the invoice PDF attached to an outgoing email is automatically replaced with the actual SMTP "From" address used to send that message, so the recipient always sees an address that matches the sender and can safely reply to it. This behavior is opt-in per email configuration via the **Use From Address as invoice company email** setting on that configuration — when disabled (the default), the invoice PDF keeps showing the company email from Settings > Company Information regardless of which configuration sent the message.

Every send attempt (normal or reminder) is recorded in an **Email Log** on the invoice detail page, showing the mode, timestamp, and success/failure. Recipient addresses are masked by default and can be revealed with a click. SMTP servers that silently reject all recipients (e.g. when the "From" address isn't authorized for the authenticated account) are now detected and logged as a failure instead of appearing to succeed.

---

## License

This software is released into the **public domain** under the [Unlicense](LICENSE). You are free to use, copy, modify, and distribute it for any purpose without restriction.
