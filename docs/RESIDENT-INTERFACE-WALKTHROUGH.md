# Resident Interface local evaluation walkthrough

## Scope

Use the approved `pavitter/resident-interface` checkout, not Jon's upstream main
branch or Michael's repository. This is a local, non-production evaluation.
Check the repository LICENSE and the applicable access grant before sharing
source with another party; no redistribution permission is added by this guide.

## Start

1. Start Docker. Install the project's dependencies with
   `pnpm install --frozen-lockfile`.
2. Run `npm start`. This initializes loopback-only PostgreSQL, MinIO, and
   Mailpit; applies migrations; builds every application route; and starts the
   local production server. Initial startup takes longer, but routes do not
   compile on first click. It preserves any existing `.env.local`.
3. Open `http://127.0.0.1:3000`, not a public URL. Keep
   `http://127.0.0.1:8025` open as the private local inbox; it captures
   invitations without delivering them to real addresses.
4. Select **Open local workspace**. You enter the persisted sender workspace.

For a fictional, Resident Interface-style starting point, upload
`templates/pdf/resident-interface-evaluation-agreement-packet.pdf`. The
three-page packet includes a resident agreement, consent page, and move-in
checklist, with clearly marked fictional terms. It is suitable for rehearsing
packet creation, two-signer routing, fields, and wet-sign return; it is not an
approved Resident Interface form.

Use Node.js 22 (the version used for local verification) and the package manager
version recorded in `package.json`. Dependency installation and the viewer's CDN
assets require internet access. Keep `.env.local` private and never include it
or the Docker database/storage volumes in a source handoff.

## Walkthrough

1. In **Send**, upload a representative, non-production Resident Interface
   agreement (and any related PDFs) to assemble an ordered packet, or choose a
   template. Add the resident and property representative. **Parallel** is the
   default; select **Sequential** only when resident-first signing is required.
2. In **Fields**, select the recipient before placing each field. Drag every
   signature, initials, name, email, date, text, and checkbox field to the
   agreement's actual line, then review every page at normal zoom. Do not rely on
   automatic placement to find semantic form fields.
3. Review and create the requests. Keep **Electronic signatures only** selected:
   the visible DWS digital-seal choice is explicitly deferred for this POC.
   In this local package, each active-recipient invitation appears in Mailpit at
   `http://127.0.0.1:8025` and does not leave the machine.
4. Open the captured invitation in Mailpit and follow its signing link, or open
   a pending document's detail page and use **Open signing session** to evaluate
   a recipient's flow inside the workspace. Opening a session replaces that
   recipient's previous link.
5. Capture a clearly labeled test signature. After submission, inspect the
   recipient's signed status and audit history. With DWS deferred, the final
   recipient leaves the document in **Finalization pending**, not completed.
6. For offline execution, open a saved draft and select **Prepare for wet
   signing**. Download the print packet, then upload a test returned PDF. Inspect
   the completed record and download its current PDF. Readability validation is
   not verification of handwritten-signature authenticity.

## Verified versus still open

Verified locally: persisted sign-in/storage; real PDF field placement and typed
signature submission; packet API page order and rendered-page equality; wet
return byte preservation; 25-recipient repapering isolation; sequential and
concurrent parallel API submission; embedded viewer-ready and decline behavior;
recipient isolation and lifecycle guard regressions.

Still open: DWS flattening/sealing (explicitly deferred), external email delivery,
separate-browser multi-recipient usability, external-origin embedding, and
performance at customer volume. API verification does not imply those checks
passed. The detailed commands and evidence are in `LOCAL-DEMO.md`.

All seven field types have now been completed through the real embedded browser
session and reconciled against stored values, signature marks, and revoked token.
The sender's email preview and review copy describe delivery as conditional on
configuration; neither claims that creating a request delivers an invitation.
CSV rejection, corrected import, field placement, and two-envelope batch creation
have also been verified through the browser and reconciled with field ownership.
PDF selection, reordering, upload, template saving, reuse, and preview have been
exercised in the browser. Newly saved packet templates retain the combined PDF
and source-document boundaries after migration 0017. Older templates remain
usable; resave from the original packet to retain its boundaries.

## Stop and restart

Stop the app with Ctrl-C. `pnpm local:stop` stops only this demo's containers and
retains the data. Run setup and start again to resume. A localhost link works on
the host machine only; sending that URL to someone else does not give them access.
