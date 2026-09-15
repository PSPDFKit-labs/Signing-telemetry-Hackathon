# Run the Resident Interface evaluation locally

From the `sign` repository, with Docker running:

```sh
pnpm install
pnpm local:setup
pnpm local:start
```

Open http://127.0.0.1:3000 and select **Open local workspace**. Use the exact
address: another app may occupy `localhost` on IPv6.

The setup starts PostgreSQL and MinIO on loopback-only ports, creates an ignored
`.env.local` with a random session secret and local sign-in password, initializes
the private storage bucket, and applies the real database migrations. Existing
`.env.local` files are preserved. Documents, templates, recipients and audit
events persist in Docker volumes. No sample dashboard counts are fabricated.

The local sign-in remains available in the loopback-only production build and is
disabled when either the configured application or database hostname is not
loopback. It represents a dedicated
evaluation coordinator and does not impersonate an OAuth account.

Use **Send** to upload PDFs or select a sample template, add a recipient, and
place fields in the document. Pending electronic documents expose **Sign within
the workspace** on their detail page. The local setup captures email in Mailpit
at `http://127.0.0.1:8025` and never sends externally. Do not configure a live
email provider for this evaluation.

For offline signing, open a saved draft's detail page and select **Prepare for
wet signing**. This changes that draft to **Awaiting wet-signed return** and
records an audit event. Use **Download print packet**, then **Upload signed
return** after execution. This route does not require DWS. PDF validation checks
readability, not the authenticity of handwritten signatures; the coordinator
must review the returned document.

The viewer can run in its evaluation mode. Set
`NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY` for a licensed evaluation. Completion
currently requires `NUTRIENT_API_KEY` for trusted server-side PDF flattening,
including when the optional digital seal is off. Do not describe an unfinalized
document as a completed signing workflow.

Stop the app with Ctrl-C. `pnpm local:stop` stops only this demo's Docker services
and retains all data. Run `pnpm local:setup` again to restart them. Do not remove
the Docker volumes unless the evaluation data is no longer needed.

`pnpm readiness` lists missing service configuration without printing secrets;
it is intended for the complete evaluation setup and will still list OAuth and
email requirements when only local sign-in is configured.

## Clean production build verification

### Separate-origin signing verified with webpack development mode

The earlier isolated runtime failure was avoided with `pnpm exec next dev
--webpack --hostname 127.0.0.1 --port 3001`, using the same code, local database,
and explicit parent origin. The anonymous PDF proxy returned 401, then the
token-authorized PDF request returned 200. `local:start` now selects webpack
explicitly to use this verified development path; the production build command
is unchanged. The internal cause of the Turbopack request-context failure has
not been established.

For document `b7bcfdea-eb29-44c2-aa69-4f72c2ed22ef`, the separate-origin parent
at port 3100 received `ready`, `viewer-ready`, `submitting`, and `completed`
from the signing iframe at port 3001. A browser-entered `TEST EMBED` mark was
submitted. Database verification found one SIGNED request with a revoked token
and one PENDING recipient. The terminal event reported `allSigned: false`:
this was recipient completion, not completed-envelope or finalized-PDF evidence.
The iframe stayed on its embedded **Signature recorded** screen.

This verifies a loopback, cross-origin first-recipient flow in one browser
profile. Actual customer HTTPS origins, separate cookie profiles, and the
customer's parent application remain unverified. DWS is still deferred.
After verification the test document was cancelled (HTTP 200) to revoke the
remaining pending link, preserving the recorded test signature. Both temporary
servers were stopped; the main demo was not restarted during this check.

### Separate-origin browser check — not passed

On 2026-09-08, `scripts/local-embed-parent.mjs` served a loopback parent at
port 3100, using a second copy of code commit `420f495` at port 3001 with
`EMBED_ALLOWED_ORIGINS=http://127.0.0.1:3100`. The browser accepted the iframe
and the parent received correctly versioned `ready` and viewer-stage `error`
events from the expected iframe window and origin. No `viewer-ready` or
successful signing event was observed.

The isolated instance's PDF proxy returned HTTP 500: Next.js reported
`headers was called outside a request scope` at its `auth()` call. Earlier
direct-Node startup attempts also hit dependency-resolution errors; switching
to `pnpm exec next dev` and moving the temporary `.next` cache aside allowed
the page and token verification to run but did not resolve the proxy error.
Therefore the successful clean build does not yet prove a clean-copy runtime
walkthrough. Investigate this reproduction before treating the package as
customer-accepted.

Fixture document `4a564db6-56e8-4114-8e6f-c00ee24b36e2` was cancelled after
the check (HTTP 200), revoking its pending links; no signatures or emails were
produced. The temporary servers were stopped. The main demo at port 3000
continued returning HTTP 200 for login. The harness accepts test document and
participant UUID arguments and requires the documented local test session;
it is not a customer integration server or a fresh-install fixture generator.

### Local embedding origin correction

At code commit `420f495`, the frame policy and parent-referrer validation agree
on HTTP loopback hosts (`localhost`, `127.0.0.1`, `[::1]`). Configuration rejects
non-HTTP protocols, insecure remote origins, credentials, paths, queries,
fragments, and wildcards. All 84 tests in 25 files passed. A configuration check
with `EMBED_ALLOWED_ORIGINS=http://127.0.0.1:3100` produced that exact additional
frame ancestor only for the embedded route; other routes retained `DENY`.
This does not substitute for an external-parent browser walkthrough.

The live development cache contained malformed generated route type files,
so in-place typecheck failed there. A clean archive build without that cache
passed compilation (6.7 seconds), TypeScript (8.1 seconds), and all 25 static
pages. The local login continued returning HTTP 200. No production deployment
or external-origin allowance was added to the running demo's configuration.

### Source ZIP verification

On 2026-09-08, the source ZIP at code commit `09271f8` was extracted with
macOS `unzip` into a fresh temporary directory, without copying `.env.local`,
database contents, or existing dependencies. `pnpm install --offline
--frozen-lockfile`, `pnpm test` (81 tests in 24 files), and the unmodified
`pnpm build` all passed. Build compilation took 6.5 seconds, TypeScript took
8.2 seconds, and all 25 static pages were generated. Dependency installation
used the machine's existing pnpm cache; a first-time network install on a
customer machine is not covered by this check.

The initial ZIP extraction exposed an incompatible Unicode logo filename.
Commit `09271f8` renamed that asset to an ASCII filename and updated its server
reference; extraction and build were then repeated successfully. Archive paths
were checked to exclude `.env.local`, `.git`, `node_modules`, `.next`, and `tmp`.
The Rosetta and module-type warnings remained non-fatal. This is packaging and
build evidence, not verification of customer access or DWS finalization.

### Latest integrated regression run

On 2026-09-08, after commit `91e0fa4`, the four main local integration scripts
passed together against the running application:

| Check | New evidence record | Result |
| --- | --- | --- |
| `local-packet-check.mjs` | `5ac6db32-c55d-4612-9584-154f161a26c6` | Four pages; ordered boundaries; page-by-page rendered equality |
| `local-wet-sign-check.mjs` | `5d42aa6d-9767-4c67-94f5-e466eee9793d` | Return completion, exact downloaded bytes, unchanged original, malformed/repeat/anonymous rejection |
| `local-repaper-check.mjs` | Batch `9d3d1d75-01fb-4243-b5ee-eb7aaf083ec8` | 25 isolated envelopes; correct field owners; unique hashed tokens; idempotent retry; zero emails |
| `local-multisigner-check.mjs` | Sequential `5eeeebaf-0875-4f90-a966-c3f3df95aae9`; parallel `374cae51-9d03-4684-8533-ee1692ce011a` | Both marks and audits preserved; order/isolation enforced; tokens revoked; finalization pending |

These are local integration results with synthetic data, not customer-volume
benchmarks, email delivery, or DWS output. They supplement the browser observations
below rather than replacing them.

On 2026-09-08, commit `a151ab7` was exported with `git archive` into a fresh
temporary directory, excluding untracked files, dependencies, and `.env.local`.
`pnpm install --offline --frozen-lockfile` and the unmodified `pnpm build` command
both passed: production compilation, TypeScript, and generation of all 25 static
pages completed. Node 22.21.1 and pnpm 10.28.0 were used. The build warned about
Rosetta translation and the existing module-type declaration; neither failed it.
No credentials were copied, no services deployed, and the running local demo's
`/login` still returned HTTP 200. This proves build reproducibility from committed
source with cached dependencies, not external service readiness or production login.

## Repeatable wet-sign API acceptance check

Browser acceptance also completed on 2026-09-08 for
`0c2f4a6d-5b62-4b21-a731-55e69eef92c8`: prepare, print-packet download event,
rejected non-PDF return, and successful test-PDF upload. The completed view
showed Wet signature returned and its audit event; the upload button disappeared.
The authenticated completed download matched the uploaded fixture byte-for-byte.
This uses a clearly labeled test return, not an executed resident agreement.

The invalid-upload check exposed a missing global toast renderer. The root layout
now mounts the existing toast system; browser verification confirmed both the
format-mismatch error and successful-return notification are visible. This also
restores feedback for existing send, cancel, and save callers.

With the app running and email credentials absent, run:

```sh
node scripts/local-wet-sign-check.mjs
```

This creates a new, clearly named test record in the local database. It signs in
through the real local authentication endpoint, exports a seeded PDF, adds a
test-only notice, uploads it, and verifies byte-for-byte completed retrieval,
original preservation, the audit hash, malformed/repeat rejection, and anonymous
download denial. It leaves the record for inspection and a PDF in ignored
`tmp/pdfs/`. It does not simulate an authentic handwritten signature, test the
browser file picker, or send email. Do not use its test return as a real agreement.

Verified on 2026-09-08 (local time): record
`a71a08ee-f541-4382-9e04-8ba0961236dc`, two pages, all ten API/storage checks
passed. Both downloaded PDF pages were rendered and visually inspected.

## Repeatable packet API acceptance check

With the app running and Poppler's `pdftoppm` installed, run:

```sh
node scripts/local-packet-check.mjs
```

This uploads the seeded Service Agreement and NDA through the real upload API,
reverses their order, combines them, saves a test draft, and downloads the stored
packet. It verifies source sizes against stored bytes, document/page boundaries,
the persisted manifest, and exact rendered-page equality with each source page.
It also rejects empty packets, more than 25 documents, and another user's upload
path. Test artifacts remain under ignored `tmp/pdfs/packet/`; test records remain
in the local workspace. It does not test the browser reorder controls or signing.

Verified on 2026-09-08 (local time): record
`8237a45e-a7df-46c7-86c7-cc8b12daea1c`, four pages, all seven checks passed.
The check first exposed incorrect client-supplied source sizes in the manifest;
the packet endpoint now derives those sizes from the stored files.

## Repeatable bulk-repapering API acceptance check

With the local app running and email credentials absent:

```sh
node scripts/local-repaper-check.mjs
```

This creates a labeled source draft and 25 test-only recipient envelopes using
`resident-demo.test` addresses. It verifies concurrent retry idempotency,
recipient/field isolation, unique hashed tokens, source preservation, one batch
audit event, invalid/duplicate/oversized input rejection, and zero reported email
deliveries. Records are retained for inspection. It does not test the browser CSV
picker, delivery, recipient interaction, finalization, or high-volume throughput.

Verified on 2026-09-08 (local time): source
`4056dfd1-471e-4edd-b3a1-41256e7e2110`, batch
`3f093e34-7f3a-4352-99c8-8767618f4846`; all nine checks passed.

## Explicitly deferred

At the user's direction, DWS-backed electronic finalization remains open and no
API key is required for the current local work. Electronic-only flattening and
optional digital sealing have not been verified end to end. This is an explicit
evaluation limitation, not a passed acceptance gate.

## Draft-edit safety regression check

Run `node scripts/local-draft-guards-check.mjs` with the local app running. It
creates one disposable test draft, confirms editing works, forces a recipient
insert failure to verify rollback, and checks that all six non-draft statuses
reject recipient/field changes. Deleted drafts also reject changes. The test
compares stored data after every rejected edit and leaves its fixture in trash.

This check deliberately sets statuses directly in its own database fixture; it
tests edit authorization and transaction rollback, not lifecycle completion.
Verified on 2026-09-08: `18561f59-8885-434a-b68d-c5d63c4a1915`, all five checks
passed. Both sender-edit endpoints now hold the document row lock while checking
draft status and saving their changes.

## Embedded viewer observation

On 2026-09-08, document `f400b2e5-d2d9-464c-ae3d-08651824095f` opened through
**Open signing session** in the local document detail page. The iframe loaded the
three-page Service Agreement and its assigned signature field; the parent
received the viewer-ready event and displayed **Ready for signature**. The local
embedded route's response restricts framing to `frame-ancestors 'self'`.

The earlier bulk-test fixture was sufficient to check database ownership but
was not valid SDK input (missing annotation/form-field schema properties). The
fixture now follows the real editor export's versioned annotation shape; the
25-envelope API check passed again with batch
`de272b54-1f2d-4b41-b32d-7e0c8e830545`. This observation does not establish
completion, external-origin framing, or every lifecycle event.

The signing page now displays the document owner's name as **Sent by**, not the
first recipient's name. `node scripts/local-sender-check.mjs` verifies distinct
sender/recipient identities through an actual recipient-scoped embed session
(requires the bulk-test records). It rotates the selected test recipient's link
without printing it. Verified on 2026-09-08 for
`c9b95992-4d87-4c71-b6a2-0a86cdf02689`.

## Decline verification

### Cancellation regression

`node scripts/local-cancel-check.mjs` passed on 2026-09-08 for
`e6efd3ee-9845-4c0d-8873-13514fd755a9`. A real issued signing link verified before
cancellation and failed afterward. Two concurrent cancellation requests produced
one success, one already-cancelled rejection, and one cancellation audit entry.
The pending request was cancelled and its token revoked; a synthetically marked
signed peer remained signed. Completed, declined, and deleted states rejected
cancellation. Email delivery remained unconfigured. The document transition,
request updates, and audit now share a transaction and document row lock.
This is API/concurrency evidence, not browser cancellation or actual email delivery.

Browser cancellation was subsequently verified on disposable CSV envelope
`d5e96f77-f633-4eb2-988e-93802febe0a2`. Confirmation explicitly explains token
revocation, preserved signatures, and conditional email delivery. The list
refreshed to Cancelled with cancellation disabled; database inspection confirmed
a cancelled request, revoked token, retained sent audit plus cancellation audit,
and undelivered notification records. No recipient email was delivered.

The embedded browser flow was used to decline test document
`f400b2e5-d2d9-464c-ae3d-08651824095f` on 2026-09-08. The parent refreshed to
**Declined**, removed the signing controls, and showed the recipient's decline
audit. Database checks confirmed the declined request and revoked token. The
notification record correctly showed no delivery. UI wording no longer claims
the sender was emailed regardless of delivery outcome.

`node scripts/local-decline-check.mjs` additionally tests expired/deleted/wet
guards, preservation of previously signed participants, cancellation of pending
peers, revoked links, and one decline audit. All seven checks passed for
`17e0f901-62ce-4795-a271-e6f22c4ad80b`. It uses synthetic request states to test
preservation (not actual signature execution), and leaves its fixture in trash.

## Real signature capture, with finalization deferred

On 2026-09-08, a typed **TEST ONLY** signature was placed and submitted through
the embedded Nutrient viewer for `c9b95992-4d87-4c71-b6a2-0a86cdf02689`. The
first submission exposed a mismatch in server validation: SDK exports use `bbox`
arrays, while the validator only read in-memory `boundingBox` objects. The
validator now supports both, rejects malformed/nonpositive geometry, and retains
recipient and overlap checks. Regression coverage includes foreign recipients
and out-of-field marks.

The real browser retry succeeded. PostgreSQL shows the request **SIGNED** with
a signing timestamp and revoked token; the merged document has four annotations.
The parent refreshed to **1 / 1**, **Signed**, and **Finalization pending**.
The document remains **IN_PROGRESS**, annotations are not finalized, and no
completed PDF exists, as expected without DWS. This verifies real capture and
submission, not a completed electronic agreement.

## Two-recipient API routing checks

### Sequential browser acceptance

`local-browser-routing-fixture.mjs` prepares a two-signer test without capturing
signatures. Browser run `b2390e1d-9a9f-4649-bcf1-f3a177cd716a` then captured
distinct TEST ONE and TEST TWO signatures in separate standalone recipient tabs.
Before the first submission, second-signer session creation returned 409.
Clicking the foreign field did not open signature input. After the first
submission, second-signer activation succeeded. Both marks persisted, both
requests became SIGNED, both tokens were revoked, and finalization stayed pending.
These were separate token-scoped tabs in the same browser, not isolated cookie
profiles. Parallel browser and cross-profile checks remain open.

The second viewer initially failed because an empty value map was persisted as
`formFieldValues: {}`. Merging now serializes viewer-native name/value arrays;
recipient loading also normalizes legacy maps without changing stored records.
Retrying the same second-signer link then loaded successfully. Regression tests
cover empty/populated legacy maps and preserve array-native payloads.

Normalization also runs in the shared viewer loader and the headless current-PDF
export path, so those consumers do not pass legacy value maps to the SDK.
Typecheck and all 81 tests passed. A browser export attempt on `c9b95992…` did
not produce an observed download event within 15 seconds and exposed no error;
the missing browser event was subsequently resolved by inspecting Downloads.
The exported three-page PDF was present; Poppler reported no form fields, and
rendering page 1 confirmed the recorded TEST ONLY mark. The evaluation viewer
adds a prominent evaluation watermark. The fixture's mark overlaps its heading
because that test deliberately used a top-of-page bounding box; it is not a
customer-ready document layout. No menu-handler change was needed. This verifies
current-state client export, not trusted server finalization or digital sealing.
The DWS deferral and wet-return byte-comparison evidence remain unchanged.

`node scripts/local-multisigner-check.mjs` reuses the real browser-exported
**TEST ONLY** image mark above, creates fresh two-recipient drafts through the
sender APIs, and submits through recipient tokens. It requires the documented
capture fixture, disabled email, and deferred DWS. On 2026-09-08 it verified:

- Sequential activation and rejection of the second signer before the first.
- Rejection of another recipient's mark as a substitute for one's own.
- Concurrent parallel submissions without losing either mark.
- Preserved canonical fields, two signed requests, two signature audit events,
  and token revocation.
- Finalization remains pending and no completed PDF is invented.

Passing records: sequential `85050b50-9cb5-4d7a-aba3-15472a89df31`; parallel
`65c5165a-9462-42b6-9463-8ce44a85a11b`. The test handles the explicit token-rotation
conflict by requesting a fresh embed session; it does not ignore order denials.
This is API routing/concurrency evidence, not a separate-browser UX test or DWS
completion evidence.

## Browser packet upload and template reuse

On 2026-09-08, two sample PDFs were selected through the browser file chooser,
reversed with the ordering control, uploaded, and saved as a template. The UI
reported two documents / four pages. Draft `fbf48400-c7ba-4e6e-97ed-3e4aba3c5c79`
stores `source-1.pdf` on page 1 and `source-0.pdf` on pages 2–4. Template
`a58ca711-0362-4868-8302-703437c426be` references that exact assembled PDF.
Its library Use action reopened sender setup; Preview rendered the first NDA
page and reported 1/4 pages. This verifies upload, reorder, save, reuse, and
preview controls. Full rendered-page equivalence remains covered by the earlier
packet API check, not by this browser observation.

Migration 0017 adds packet manifests to templates. Newly saved templates snapshot
the manifest from the owner's matching persisted source document; reuse takes
the template's server-stored manifest, ignoring a client override. Existing
templates without a manifest remain usable as combined PDFs; save a new template
from the original packet to retain its boundaries. No historical data is guessed.
`node scripts/local-packet-template-check.mjs` passed after the local migration:
template `91a016d9-4cf4-4c80-8006-32f9a081bb1c`, reused document
`0c2f4a6d-5b62-4b21-a731-55e69eef92c8`. Source boundaries and combined PDF matched.

## Browser CSV acceptance

Browser acceptance on 2026-09-08 rejected a file containing a duplicate on row 3
and invalid email on row 4, showing both errors and leaving Next disabled with
no recipients imported. A corrected two-row file advanced through field placement,
message, review, and batch creation. Batch `680a5093-8baf-4e50-a19a-3e1bd42dc1bb`
created documents `9bd5ec93-9175-474d-b48d-c8c523fe7d1b` and
`d5e96f77-f633-4eb2-988e-93802febe0a2`; database inspection confirmed separate
participant IDs and correctly retargeted signature field ownership and emails.
Email credentials were absent. No real resident records were used.

The resulting Sent page exposed and led to a fix for count-derived completion:
it now uses stored lifecycle state, with signer-only counts for progress. Browser
verification shows `66194c52…` as Pending / Finalization pending, the zero-recipient
packet `8237a45e…` as Draft, and the returned wet document `a71a08ee…` as Completed.
String-valued database counts no longer misclassify empty drafts as completed.

Use one recipient per line and exactly one name column and one email column
(the supported Resident Name / Email Address aliases also work). Quoted commas
and doubled quotes are supported. Quoted multiline fields are rejected. Blank
lines are ignored, but reported row numbers still match the original file.
Malformed quotes, mismatched column counts, ambiguous identity headers, invalid
emails, and duplicates block the entire UI import; valid rows are not silently
sent from a file with errors. Parser regressions cover these cases separately
from the API batch-isolation checks.

## Signing submission lifecycle guards

### Resend lifecycle verification

`node scripts/local-resend-check.mjs` passed on 2026-09-08 for
`13b7fc4b-e97c-4c7f-96f9-ac8fdedf8d5e`. Resend invalidated the previous link;
draft, completed, declined, cancelled, wet, and deleted states rejected resend.
An expired request required an explicit future deadline. Concurrent resend and
cancellation finished cancelled with a revoked token, not resurrected pending.
Resend now locks the document before reading recipient state and commits request
rotation, document update, and audit together. Email remains unconfigured; this
does not prove delivery or browser reminder usability.

### Sender lifecycle guards

`node scripts/local-send-guards-check.mjs` passed on 2026-09-08 using fixture
`1502640e-b895-4a1c-a40b-e998df755bab` (left in trash). Electronic sending rejects
completed, declined, cancelled, awaiting-wet-signature, deleted, wet-method, and
expired documents without creating signing requests or a sent audit event.
Valid sending and idempotent replay also passed, with zero emails delivered.
The send transaction rechecks document eligibility under a row lock before
inserting requests. This check is not evidence of email delivery.

### Recipient lifecycle guards

`node scripts/local-submit-guards-check.mjs` creates a disposable adversarial
fixture with a retained token, then verifies that submission rejects draft,
completed, declined, cancelled, wet-sign, deleted, expired, and non-signer cases.
It checks that no signature timestamp or signed audit event was written. These
are synthetic state fixtures, not evidence of completing those lifecycles.
All six checks passed on 2026-09-08 for
`3613bb27-4ec5-454b-874b-c1c3c631c29c`; the fixture was left in trash.

## Seven-field sender UI check

On 2026-09-08, template quick-start, self-recipient setup, and rapid click
creation of signature, initials, name, email, date, text, and checkbox fields
were exercised in the real browser. Click creation now serializes operations
and finds page-bounded positions that do not overlap existing annotations.
When no position fits, it asks the user to choose another page or move fields.
This positions fields relative to other annotations, not semantically in blank
areas of the underlying agreement; users must still review and move them.

Undo removed the last checkbox and redo restored it. Advancing to the message
step saved all seven distinct bounding boxes in document
`66194c52-1ab1-4df7-8c90-24fae3fc0f26`. Every field now carries the authenticated
`coordinator@resident-demo.test` identity, not a fabricated placeholder address.
Recipient-side completion was also verified in the real embedded browser session.
The test-only signature (`TEST ONLY`) and separate initials (`TO`) were applied;
name, email, date, free text, and a checked checkbox were submitted successfully.
Database inspection confirmed all five field values and both image marks persisted,
the recipient became `SIGNED`, and its signing token was revoked. The sender view
refreshed to 1/1 signatures and **Finalization pending**. The document remains
`IN_PROGRESS` with no completed PDF path, as expected without the deliberately
deferred DWS key. This verifies field capture, not electronic PDF finalization.
