# Nutrient Sign

A full-stack document signing application built with [Next.js](https://nextjs.org) and the [Nutrient Web SDK](https://www.nutrient.io/sdk/web/). Upload PDFs, place signature fields, send documents to recipients, and apply digital signatures — all from the browser.

Use it as a **reference implementation** to learn how the Nutrient SDK handles document viewing, annotation, and signing, and to evaluate the SDK against your own documents and workflows.

> **This is a sample, licensed for evaluation.** It is proprietary to Nutrient and provided
> for internal, non-production evaluation and testing only — not for redistribution,
> production use, or reuse in your own codebase. See [`LICENSE`](LICENSE) and
> [Licensing](#licensing).
>
> No claims are made about its legal validity, regulatory compliance, security, or fitness
> for any purpose. See [Support and disclaimers](#support-and-disclaimers).

## Features

### Resident Interface local evaluation

This branch (`pavitter/resident-interface`) contains the Resident Interface POC
changes. Use an approved checkout of this branch; the upstream clone command in
the generic setup below does **not** include these changes.

With Docker running, from this checkout:

```sh
pnpm install --frozen-lockfile
pnpm local:setup
pnpm local:start
```

Open `http://127.0.0.1:3000` and choose **Open local workspace**. No Vercel,
OAuth, AWS account, email credentials, or DWS key is needed for this local path.
Internet access is still needed for initial dependencies, container images, and
the viewer's CDN assets. Do not follow the generic environment-copy step after
local setup: it would replace the generated local configuration.

Electronic signature capture works, but completed electronic PDFs and digital
sealing remain unconfigured and explicitly deferred. External emails are not
sent. Wet-return PDF storage/retrieval is available. See the
[evaluation walkthrough](docs/RESIDENT-INTERFACE-WALKTHROUGH.md) and
[detailed verification record](docs/LOCAL-DEMO.md).

The evaluation license above still applies. This local setup does not itself
grant permission to redistribute the source or use it in production.

### General reference implementation

- **Document upload and viewing** — Upload PDFs to S3 and view them in-browser with the Nutrient Web SDK
- **Drag-and-drop field placement** — Place signature, initials, name, email, date, text, and checkbox fields for each recipient
- **Multi-recipient signing** — Send documents in parallel or sequential order with individual email links
- **Guided signing** — Walk recipients through their assigned fields in reading order with live remaining-field progress
- **Electronic signatures** — Recipients draw, type, or upload their signature
- **Digital signatures** — After all parties sign, a digital signature is applied via the Nutrient DWS API
- **Email notifications** — Automated emails for signature requests, reminders, completions, and declines
- **Template library** — System templates and user-created templates for reusable documents
- **Dashboard and audit trail** — Track document status, view signing history, and download signed PDFs
- **OAuth authentication** — Sign in with Google or Microsoft accounts
- **Mobile-responsive** — Full signing experience on phones and tablets
- **Dark mode** — Toggle dark mode in the document viewer

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Language | TypeScript |
| PDF Viewer | [Nutrient Web SDK](https://www.nutrient.io/sdk/web/) (PSPDFKit) |
| Digital Signing | [Nutrient DWS API](https://www.nutrient.io/api/) |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/) |
| Authentication | [Auth.js](https://authjs.dev/) (Google, Microsoft Entra ID) |
| Storage | AWS S3 |
| Email | [Resend](https://resend.com) (or SendGrid) |
| UI | [Tailwind CSS 4](https://tailwindcss.com), [Radix UI](https://www.radix-ui.com/), [React Zero UI](https://github.com/nicholasgriffintn/react-zero-ui) |
| Rate Limiting | [Upstash Redis](https://upstash.com/) (optional) |
| Deployment | [Vercel](https://vercel.com) |
| Infrastructure | Terraform (S3 bucket, CORS, policies) |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL database (local or hosted, e.g. [Neon](https://neon.tech))
- AWS account with an S3 bucket
- Nutrient Web SDK license key ([get a trial](https://www.nutrient.io/sdk/web/))
- Nutrient DWS API key ([get one](https://www.nutrient.io/api/)) — required for digital signatures
- OAuth credentials for Google and/or Microsoft

### 1. Clone and install

```bash
git clone https://github.com/jonaddams/sign.git
cd sign
pnpm install
```

### Local evaluation without OAuth or AWS

For a loopback-only workspace with local PostgreSQL, local document storage and
a development coordinator account, see [the local demo guide](docs/LOCAL-DEMO.md).
Run `pnpm local:setup` and `pnpm local:start`, then open `http://127.0.0.1:3000`.

### 2. Configure environment

```bash
cp .env.sample .env.local
```

Edit `.env.local` with your credentials:

```bash
# Authentication
AUTH_SECRET=""                    # Generate with: npx auth secret
AUTH_ALLOWED_EMAIL_DOMAINS=        # Optional comma-separated OAuth domain allowlist
AUTH_GOOGLE_ID=                   # Google OAuth client ID
AUTH_GOOGLE_SECRET=               # Google OAuth client secret
AUTH_MICROSOFT_ENTRA_ID_ID=       # Microsoft OAuth client ID (optional)
AUTH_MICROSOFT_ENTRA_ID_SECRET=   # Microsoft OAuth client secret (optional)

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/nutrient_sign"

# Email (pick one)
RESEND_KEY=                       # Resend API key (recommended)
EMAIL_FROM=signing@yourdomain.com

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name

# Nutrient Web SDK (in-browser viewing, annotation, signature capture)
NEXT_PUBLIC_NUTRIENT_SDK_VERSION=1.19.0
NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY=your-license-key

# Nutrient DWS API (server-side digital signatures and certificate inspection)
NUTRIENT_API_KEY=                 # Required to complete a signing workflow
NUTRIENT_API_BASE_URL=https://api.nutrient.io/   # Optional, this is the default

# Required in production for public signing endpoints
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

See [`.env.sample`](.env.sample) for the full list of environment variables.

`NUTRIENT_API_KEY` is a **separate credential** from the Web SDK license key — the
former authenticates server-side calls to the hosted DWS API, the latter unlocks the
in-browser viewer. Without `NUTRIENT_API_KEY`, electronic signatures can be recorded
but the document remains `IN_PROGRESS`; it never claims to be complete without a
cryptographically sealed PDF. The owner can retry failed finalization from the document
details page.

`DATABASE_TYPE` is optional (`postgres` | `neon`, defaults to `postgres`). Set it to
`neon` to use the Neon serverless HTTP driver instead of a standard Postgres connection.

### 3. Set up the database

```bash
pnpm db:generate
pnpm db:migrate
```

### 4. Set up S3

The [`infra/`](infra/) directory contains Terraform configuration for the S3 bucket with proper security policies and CORS. Alternatively, create a bucket manually with:

- Public access blocked
- CORS allowing your app domain
- HTTPS-only bucket policy

### 5. Run the dev server

```bash
pnpm dev
```

The app starts at [http://localhost:3000](http://localhost:3000). System templates are automatically seeded on first startup.

## Project Structure

```
app/
  (auth)/                  # Login and error pages
  (protected)/             # Authenticated pages
    dashboard/             # Document overview and metrics
    documents/             # Document management and detail views
    inbox/                 # Documents awaiting your signature
    send/                  # Send-for-signature workflow
    signed/                # Completed documents
    templates/             # Template management
    trash/                 # Soft-deleted documents
  api/                     # API routes
    auth/                  # Auth.js endpoints
    documents/             # Document CRUD, proxy, certificates
    sign/                  # Signature submission, decline, token verify
    templates/             # Template CRUD and download
    upload/                # Authenticated, validated S3 uploads
  sign/[token]/            # Public signing page (token-authenticated)

lib/
  auth/                    # Auth.js configuration and callbacks
  digital-signing.ts       # Nutrient DWS API integration
  email-service.ts         # Email sending (Resend/SendGrid)
  nutrient-viewer.ts       # PDF viewer SDK wrapper
  s3.ts                    # S3 client configuration
  rate-limit.ts            # Upstash rate limiting
  signing-tokens.ts        # High-entropy signing tokens and one-way hashing
  instant-json-security.ts # Signer-scoped InstantJSON validation and merge

database/drizzle/
  auth-schema.ts           # User, account, session tables
  document-signing-schema.ts  # Documents, participants, signatures, audit log

infra/                     # Terraform S3 configuration
scripts/                   # Database reset, migration, and test utilities
```

## Signing Workflow

```
1. Upload       Owner uploads a PDF → stored in S3
                 │
2. Configure    Owner adds recipients and places signature fields
                 │
3. Send         Idempotent requests; email only active signing-order recipients
                 │
4. Sign         Hashed token authorizes only that recipient's assigned fields
                 │
5. Complete     After all signatures:
                 ├── Blank page appended via DWS Build API
                 ├── CAdES B-LT digital signature applied via DWS Sign API
                 ├── Signed PDF uploaded to S3
                 └── Status set to COMPLETED, completion emails sent
```

## Key Integration Points

### Nutrient Web SDK

The viewer is loaded from CDN and initialized in [`lib/nutrient-viewer.ts`](lib/nutrient-viewer.ts). Key capabilities used:

- **Document viewing** with configurable toolbars
- **Form field creation** (signature, initials, name, email, date, text, and checkbox widgets)
- **Annotation rendering** with custom per-recipient color coding
- **Electronic signature capture** (draw, type, image)
- **Form Creator mode** for drag-and-drop field placement

### Nutrient DWS API

Digital signatures are applied server-side in [`lib/digital-signing.ts`](lib/digital-signing.ts):

1. **Build API** — Appends a blank page to the PDF for the signature appearance
2. **Sign API** — Applies a visible CAdES B-LT signature with the Nutrient logo

### UI and styling

The interface is built on the `sign-design` primitives ([`styles/sign-design.css`](styles/sign-design.css),
`components/sign-design/`) alongside shadcn/Radix components in `components/ui/`. See
[`docs/UI-CONVENTIONS.md`](docs/UI-CONVENTIONS.md) for the CSS variable namespacing,
theming, and component rules that keep the two systems from colliding.

### Document Proxy

The [`/api/documents/proxy`](app/api/documents/proxy/route.ts) route streams PDFs from S3 through the server, supporting both:

- **Session authentication** — For document owners and participants
- **Token authentication** — For recipients using their signing link

## Scripts

```bash
pnpm dev                  # Start dev server (Turbopack)
pnpm build                # Production build
pnpm typecheck            # Strict TypeScript validation
pnpm test                 # Security-focused unit tests
pnpm lint                 # Biome checks
pnpm db:generate          # Generate Drizzle migrations
pnpm db:migrate           # Run migrations
pnpm db:studio            # Open Drizzle Studio

# Utility scripts
node scripts/reset-clean.mjs      # Reset S3 + database (fresh start)
node scripts/reset-database.mjs   # Reset database only
node scripts/test-email.ts        # Test email configuration
```

## Deployment

The app is designed for [Vercel](https://vercel.com) deployment. See [`docs/VERCEL-SETUP.md`](docs/VERCEL-SETUP.md) for the complete deployment guide, including all environment variables and provider configuration.

For email setup details, see [`docs/EMAIL-SETUP.md`](docs/EMAIL-SETUP.md).

## Further Reading

- [Nutrient Web SDK Documentation](https://www.nutrient.io/guides/web/)
- [Nutrient DWS API Documentation](https://www.nutrient.io/guides/document-engine/)
- [Auth.js Documentation](https://authjs.dev/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)

## Support and disclaimers

**This is a sample, not a product.** It is provided for reference, evaluation, and testing
only. It is not covered by any Nutrient support agreement or SLA, Nutrient engineering does
not maintain it, and issues or pull requests opened here may go unanswered.

Questions about the **Nutrient Web SDK or DWS API themselves** should go through
[Nutrient's support channels](https://www.nutrient.io/support/), not this repository.
Those products are supported; this sample is not.

### No claims are made about this code

This repository makes **no claims**, express or implied, about the legal validity of
signatures it produces, its compliance with any law, regulation, or standard, its
security, or its fitness for any purpose. Nothing here has been validated, audited, or
certified by anyone, and no such assessment is planned.

The documentation describes only what the code *does* — which API it calls and what that
call is configured to request. It does not assert that the result satisfies any
requirement, in any jurisdiction, for any use case.

If you deploy this, every such determination is yours to make: signature validity and
verifiability, signer identity assurance, activity-log completeness and retention,
consent and disclosure flows, data residency and deletion, accessibility, and your own
security review. Treat the signing workflow as a working illustration of the Nutrient
APIs, and nothing more.

## Licensing

This repository contains two layers with **different owners and different terms**.

### The sample application

The application code in this repository — the Next.js app, API routes, database schema,
and UI — is **proprietary to Nutrient** and licensed under the Nutrient Reference-Use
License. See [`LICENSE`](LICENSE) for the full text. That text governs; the summary below
is orientation only.

**This is not an open-source license.** In plain language:

- Access is granted to a **named recipient**, for that recipient's **internal,
  non-production evaluation and testing** of the Nutrient products. That is the only
  permitted purpose.
- You may run and modify the code for that purpose. You may **not** redistribute, publish,
  or otherwise share it with third parties; run it in production or any live or
  customer-facing environment; or copy any part of it into your own applications, products,
  or codebases.
- The code is **confidential** — no disclosure to third parties without Nutrient's prior
  written consent, and internal access only for people who need it and are under
  confidentiality obligations.
- Copyright and proprietary notices must stay intact, and the Nutrient name, marks, and
  logos may not be used to endorse or promote a product.
- The license runs until terminated, and terminates automatically on breach. On termination
  all copies must be destroyed.

Once you hold the applicable paid Nutrient license, the production-use and code-reuse
restrictions (§3(b) and §3(c)) stop applying to the application that license covers.
Contact [sales@nutrient.io](mailto:sales@nutrient.io).

Third-party dependencies — PostgreSQL, Next.js, and everything installed from npm — are
explicitly excluded from the above and remain under their own license terms.

### The Nutrient SDKs and APIs

The [Nutrient Web SDK](https://www.nutrient.io/sdk/web/) and the
[Nutrient DWS API](https://www.nutrient.io/api/) are commercial products owned by
Nutrient and are **not** covered by this repository's license. Nothing here grants any
right to Nutrient's software, services, trademarks, or brand assets.

To run this app you must obtain your own credentials directly from Nutrient:

- a **Web SDK license key** for the in-browser viewer (`NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY`)
- a **DWS API key** for server-side digital signatures (`NUTRIENT_API_KEY`)

The SDK itself is not vendored here — it is installed from npm (`@nutrient-sdk/viewer`)
and loaded at runtime, so this repository redistributes no Nutrient binaries.

The repository does include Nutrient logo files, used in the UI and embedded in the
visible digital-signature appearance (see
[`lib/digital-signing.ts`](lib/digital-signing.ts)). Those are Nutrient trademarks, present
so the sample renders as intended. The license grants no right to use them as your own
product branding or to endorse or promote a product, and it does not permit removing or
altering the proprietary notices they carry.
