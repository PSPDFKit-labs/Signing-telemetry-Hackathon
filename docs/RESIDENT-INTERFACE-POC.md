# Resident Interface DocuSign-Replacement POC

## Objective

Demonstrate a customer-forwardable, near-out-of-the-box signing workflow for
Resident Interface's template-driven legal documents. The sample focuses on the
effort and product capabilities needed to replace the current DocuSign workflow;
it is not a production or legal-compliance certification.

## Requirement map

| Resident Interface need | POC behavior | Main implementation |
| --- | --- | --- |
| Reuse and maintain legal-document templates | Upload a PDF, save it as a template, preview it, and start future sends from the template library | `app/(protected)/templates`, `app/api/templates`, `lib/seed-system-templates.ts` |
| Prepare documents without rebuilding them | Add recipient-owned fields directly on the PDF; undo and redo placement changes | `app/(protected)/send/components/steps/FieldPlacement.tsx` |
| Cover normal agreement fields | Signature, initials, name, email, date, free text, and checkbox fields | `app/(protected)/send/components/steps/field-placement` |
| Support more than one participant | Add multiple recipients and choose parallel or sequential signing | `RecipientConfig.tsx`, `DocumentFlow.tsx`, `app/api/documents/[id]/send` |
| Deliver an external signing request | Send a recipient-specific, high-entropy link by email; stored tokens are one-way hashed | `lib/signing-tokens.ts`, `lib/signing-notifications.ts`, `app/api/sign/verify-token` |
| Make signing unmistakably simple | Start at the first incomplete field, follow page/top/left reading order, show fields remaining, and automatically continue after signatures, initials, and checkboxes | `components/sign-here-widget.tsx`, `lib/signing-field-navigation.ts` |
| Prevent one recipient changing another's work | Expose only the verified recipient's assigned fields and validate/merge submitted Instant JSON on the server | `app/sign/[token]/page.tsx`, `lib/instant-json-security.ts` |
| Handle the complete workflow | Track views, signatures, declines, reminders, cancellations, and signing-order advancement | `app/api/sign`, `app/api/documents/[id]`, `database/drizzle/document-signing-schema.ts` |
| Return a finished PDF | Merge trusted signer state, apply the configured DWS digital signature, store the signed PDF, and provide download/completion email paths | `lib/digital-signing.ts`, `app/api/sign/submit`, `DownloadButton.tsx` |
| Send an ordered packet | Combine multiple uploaded PDFs into one ordered signing envelope while retaining source-document page boundaries | `components/ui/packet-upload.tsx`, `app/api/documents/packet`, `lib/document-packets.ts` |
| Repaper at volume | Import a recipient CSV and produce isolated, individually auditable envelopes with recipient-owned fields and links | `RecipientConfig.tsx`, `app/api/documents/[id]/repaper`, `lib/repapering.ts` |
| Choose the finalization policy | Complete electronically with a trusted flattened PDF or opt into a DWS cryptographic seal | `ReviewAndSend.tsx`, `lib/finalization-policy.ts`, `lib/digital-signing.ts` |
| Support offline execution | Export a printable packet, track an awaiting-wet-signature state, and return a verified PDF as the completed record | `app/api/documents/[id]/wet-sign`, `WetSignActions.tsx`, `lib/wet-signing.ts` |
| Embed signing in Resident Interface | Mint an owner-authorized iframe URL, restrict framing to configured origins, and emit a versioned lifecycle event contract | `app/api/documents/[id]/embed-session`, `app/embed/sign/[token]`, `lib/embed-contract.ts` |

## Recommended customer demo

1. Open **Templates** and select or upload a representative Resident Interface
   legal document.
2. Add two recipients and choose sequential signing.
3. Place a mix of signature, initials, identity, text, date, and checkbox fields;
   demonstrate undo and redo.
4. Review the email and routing configuration, then send.
5. Open the first recipient's link in a private browser session. Select **Start**
   and show the guided field-to-field experience and remaining-field count.
6. Complete the first recipient's fields and show that only the next signer is
   activated.
7. Complete the final signer, then show the audit history and download the
   finalized PDF.
8. If time permits, demonstrate resend, decline, cancel, duplicate, and reuse
   from a template.

## Integration shape

- Nutrient Web SDK provides PDF rendering, form-field placement, signature
  capture, annotations, and recipient-facing interaction.
- The Next.js routes orchestrate authenticated sender actions and token-scoped
  recipient actions.
- PostgreSQL stores documents, participants, requests, and audit events; S3
  stores source and completed PDFs.
- Resend or SendGrid delivers invitation, reminder, decline, and completion
  messages.
- Nutrient DWS finalizes the merged PDF and applies the configured digital
  signature when the sender selects digital sealing. Electronic-only completion
  retains the same trusted flattening path without the additional seal.
- The embedded route and lifecycle message protocol let Resident Interface keep
  the recipient inside its own agreement experience. See `docs/EMBEDDING.md`.

## Implemented capability inventory (not customer acceptance)

The checks below identify code paths that exist. They do not establish that the
configured application has successfully executed them. The current checkout has
working loopback-only sign-in, PostgreSQL, and MinIO; `pnpm readiness` still
reports missing external service credentials. See `docs/LOCAL-DEMO.md` for exact
local acceptance evidence and remaining limitations.
The simulated dashboard is no longer the application entry point. `/` directs
visitors to the authenticated, persisted workflow.

- [x] Template-first sender workflow
- [x] Seven common recipient field types
- [x] Parallel and sequential multi-recipient routing
- [x] Recipient-specific email links
- [x] Guided, reading-order signing with progress and one-click auto-advance
- [x] Recipient-isolated field editing and server-side payload validation
- [x] View/sign/decline/cancel/resend audit lifecycle
- [x] Trusted merge, finalization, completion notifications, and PDF download
- [x] Customer-forwardable setup and implementation guidance
- [x] Ordered multi-document packets/envelopes
- [x] CSV bulk recipient import and isolated high-volume repapering
- [x] Optional DWS digital sealing
- [x] Wet-sign export, waiting state, and returned-document workflow
- [x] Origin-restricted embedded signing with lifecycle events

Production adoption still requires Resident Interface's own legal-validity,
identity-assurance, accessibility, retention, data-residency, security, and
operational review. See the repository `README.md` and `LICENSE` for the sample's
evaluation-only terms and disclaimers.

## Customer handoff gate — currently NOT passed

### Current local acceptance, 2026-09-08

The user requested local execution, not a Vercel deployment, and explicitly
deferred the DWS key/finalized electronic PDF. The remote-access gate below is
retained as a separate customer-access checklist, not a requirement to deploy
without authorization. The local evaluation is not a production signing service.

| Requirement | Verified evidence | Remaining acceptance |
| --- | --- | --- |
| Local start and persisted workspace | `local:setup`, browser sign-in, PostgreSQL/MinIO, live local routes | Customer machine setup not observed |
| Multi-document packets | Browser upload/reorder; API rendered-page equality; four-page packet persisted | Actual anonymized Resident Interface forms |
| Templates and seven fields | Browser save/reuse; all seven field types submitted and stored; manifest reuse API check | Full editing walkthrough on their forms |
| CSV and repapering | Browser bad-row rejection and two-envelope creation; 25-recipient isolation API check | Customer-volume performance and email delivery |
| Electronic signing and embedding | Real iframe field capture and parent refresh; sequential/parallel API checks | Separate-browser multi-recipient walkthrough; external-origin integration |
| Optional sealing/final PDF | Pending state is explicit; no completed electronic PDF claimed | DWS flattening and seal intentionally deferred by user |
| Wet return | Browser export/upload/error/success; completed download byte equality; API repeat-return rejection | Actual signed customer scan not tested |
| Lifecycle | Browser decline/cancel; API expiration, resend token rotation, cancellation races and audit checks | Browser resend; real notification delivery |

Detailed fixture IDs, commands, limitations, and observations are in
`LOCAL-DEMO.md`; runnable instructions are in `RESIDENT-INTERFACE-WALKTHROUGH.md`.
The latest configuration check still reports missing viewer license, DWS, email
sender/provider, and OAuth. Local sign-in works through the deliberately
loopback-only evaluation provider; it does not establish customer OAuth access.
The viewer currently runs in evaluation mode. No customer data or emails have
been sent and no public hosting has been created.

### Remote/customer-access acceptance (not yet authorized or verified)

Record actual artifacts and observations for every item before sending a link.
Unit tests and a successful build cannot substitute for these runs.

- [ ] An HTTPS evaluation URL opens and a permitted sender can sign in.
- [ ] Upload representative legal PDFs, reorder the packet, and verify every page.
- [ ] Save and reuse a template; place and edit each supported field type.
- [ ] Import a CSV with valid, invalid, and duplicate rows; verify the resulting
      envelopes have the correct isolated recipient ownership and delivery status.
- [ ] Complete two-recipient sequential and parallel electronic signing; check
      recipient isolation and sequencing in separate browser sessions.
- [ ] Complete signing in the document record's iframe; observe lifecycle events
      and reconcile completion against the database.
- [ ] Download and inspect an electronic-only completed PDF with all submitted
      values preserved. Current server-side flattening still requires DWS.
- [ ] Complete the optional digital-seal flow and inspect its resulting PDF.
- [ ] Export a wet-sign packet, return a readable signed scan, and retrieve that
      exact scan from the completed record. Reject malformed PDFs and repeat returns.
- [ ] Verify reminders, decline, cancellation, expiration, and audit records.
- [ ] Confirm the customer can access the evaluation and that delivery uses the
      intended sender account. No customer emails have been sent during setup.

Use `pnpm readiness -- --production` to check configuration presence before these
tests. Supply credentials through the deployment environment or ignored
`.env.local`, never in this document. The command does not print secret values.
