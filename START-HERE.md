# Resident Interface local evaluation

This package contains the Resident Interface work from
`pavitter/resident-interface`, based on Jon's demo. It is not Michael's repository
and is not a production DocuSign replacement. Read `LICENSE` and confirm the
applicable recipient access grant before sharing or using the source.

## Run locally

Prerequisites: Node.js 22, Docker, and internet access for initial dependencies
and the PDF viewer's CDN assets. Node 21 is not supported.

```sh
nvm install 22
nvm use 22
npm install
npm start
```

`npm start` is the supported handoff command after `npm install`. It checks
for Node 22 and native dependencies before starting Docker or building.
If you ever switch between Rosetta/x64 and native Apple Silicon Node, or an
earlier npm install created broken dependencies, run
`rm -rf node_modules && npm install` after switching to Node
22, then run `npm start` again.

Open `http://127.0.0.1:3000` and select **Open local workspace**.
Setup creates private local configuration and persistent local database/storage.
Do not replace that generated configuration with `.env.sample`. Do not expose
this local sign-in mode to the network or use live resident information.
`npm start` prepares the local database/storage, applies migrations, builds the
entire application once, starts the loopback-only production server, and checks
local sign-in, built-in templates, PDF retrieval, and the private inbox. Do not
start presenting until the terminal prints **Local demo smoke check passed**.
The initial startup takes longer, but page navigation is responsive immediately
afterward. Open `http://127.0.0.1:8025` to inspect every captured invitation;
Mailpit never delivers mail beyond this machine. Run `npm run local:smoke` at
any time to repeat that non-destructive check. `pnpm serve` remains available for a separately built,
fully configured production deployment. A hosted evaluation needs its own
database, storage, authentication, and application URL configuration; do not
copy `.env.local` to a host.

## Evaluate

- Upload and order PDFs into a packet, or reuse a saved template. For a
  fictional three-page Resident Interface-style example, upload
  `templates/pdf/resident-interface-evaluation-agreement-packet.pdf`. It is
  explicitly marked TEST ONLY and contains no customer information.
- Add recipients and place signature, initials, name, email, date, text, and
  checkbox fields. Review their locations; automatic placement avoids other
  fields but does not locate semantic signature lines in an agreement.
- Import a name/email CSV to create an individual envelope per recipient.
- Open a recipient signing session from the document record. Sequential routing
  activates later recipients after earlier signers finish.
- Try print/export-and-return for wet signing, then retrieve the returned PDF.

Use `docs/RESIDENT-INTERFACE-WALKTHROUGH.md` for the walkthrough and
`docs/EMBEDDING.md` for the integration contract. Tests and exact verification
limits are recorded in `docs/LOCAL-DEMO.md`.

## Customer-form acceptance test

Resident Interface supplies the document and recipients; this package deliberately
does not include customer agreements or data. Run the following with a
representative, non-production agreement:

1. In **Send**, upload the agreement (and any accompanying PDFs), set the order,
   and add the resident and property representative. Keep **Parallel** selected
   unless the packet specifically needs resident-first routing.
2. In **Fields**, select each recipient, then drag a **Signature**, **Date**,
   **Initials**, **Name**, **Email**, **Text**, or **Checkbox** field onto that
   person's actual line. Review every page at normal zoom before continuing;
   automatic placement is only a starting point.
3. In **Review**, retain **Electronic signatures only**. The visible DWS option
   is intentionally deferred and must not be presented as configured.
4. Send the test packet. Open `http://127.0.0.1:8025` and inspect the captured
   invitation, then use its signing link or select the recipient from the
   document page and use **Open signing session**. Complete their fields and
   submit; repeat for the second recipient. In local mode this replaces a
   recipient's prior test link and never sends mail externally.
5. Confirm the document record reports every recipient signed, inspect its
   activity history, and download the resulting current PDF. Record any field
   that landed on the wrong line or any status/audit discrepancy.
6. Separately create a draft using **Prepare for wet signing**, download the
   printable packet, add a clearly marked test wet signature, upload that PDF
   back into the draft, and verify the completed record and downloadable return.

## Important limits

- Local setup captures email in Mailpit at `http://127.0.0.1:8025`; it never
  delivers externally. Localhost signing links do not work remotely.
- The viewer runs in evaluation mode without a license key; client exports
  carry an evaluation watermark.
- DWS PDF flattening/sealing is deliberately left open. Captured electronic
  signatures can be saved while the document remains **Finalization pending**.
  Current-state client export is not trusted server finalization.
- Sample agreements are demonstrations, not Resident Interface's approved forms.
  Customer-form review, customer-volume performance, external-origin integration,
  and independently configured customer access remain unverified.
- This source package includes no database records, uploaded documents, local
  passwords, or service credentials. Local integration scripts that reference
  historical test fixture IDs require those fixtures and are not fresh-install
  smoke tests. Unit tests run with `pnpm test`.

Stop the app with Ctrl-C; `pnpm local:stop` stops the demo containers while
retaining data. The package grants no rights beyond its existing license.
