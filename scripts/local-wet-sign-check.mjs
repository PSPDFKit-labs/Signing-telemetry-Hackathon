import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import postgres from 'postgres';

config({ path: '.env.local', quiet: true });
const base = 'http://127.0.0.1:3000';
assert.equal(process.env.LOCAL_DEMO, 'true');
assert.equal(process.env.NEXT_PUBLIC_APP_URL, base);
assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
assert.equal(new URL(process.env.DATABASE_URL).port, '54329');
assert.ok(process.env.LOCAL_DEMO_PASSWORD);
// This check must never send a notification outside the local evaluation.
assert.ok(!process.env.RESEND_API_KEY && !process.env.SENDGRID_API_KEY, 'Disable email delivery for this test');
const cookies = new Map();
async function request(path, options = {}) {
  assert.ok(path.startsWith('/') && !path.startsWith('//'));
  const response = await fetch(base + path, {
    ...options,
    redirect: 'manual',
    headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...options.headers },
  });
  for (const value of response.headers.getSetCookie()) {
    const [pair] = value.split(';');
    const split = pair.indexOf('=');
    cookies.set(pair.slice(0, split), pair.slice(split + 1));
  }
  return response;
}
const csrf = await (await request('/api/auth/csrf')).json();
await request('/api/auth/callback/local-demo', {
  method: 'POST',
  body: new URLSearchParams({
    csrfToken: csrf.csrfToken,
    password: process.env.LOCAL_DEMO_PASSWORD,
    callbackUrl: `${base}/dashboard`,
  }),
});
const session = await (await request('/api/auth/session')).json();
assert.equal(session.user?.email, 'coordinator@resident-demo.test', 'Local sign-in failed');
const templates = await (await request('/api/templates')).json();
const template = templates.templates.find((item) => item.isSystem);
assert.ok(template, 'A seeded template is required');
const created = await request('/api/documents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'TEST ONLY - wet-sign acceptance',
    templateId: template.id,
    documentFilePath: template.templateFilePath,
  }),
});
assert.equal(created.status, 200);
const { document } = await created.json();
const route = `/api/documents/${document.id}/wet-sign`;
assert.equal((await request(route, { method: 'POST' })).status, 200);
const exported = await request(route);
assert.equal(exported.status, 200);
const original = new Uint8Array(await exported.arrayBuffer());
const pdf = await PDFDocument.load(original);
assert.ok(pdf.getPageCount() > 0);
const font = await pdf.embedFont(StandardFonts.HelveticaBold);
for (const page of pdf.getPages()) {
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: 48, color: rgb(1, 1, 1) });
  page.drawText('TEST RETURN ONLY - NOT AN EXECUTED AGREEMENT', {
    x: 16,
    y: 20,
    size: 11,
    font,
    color: rgb(0.7, 0, 0),
  });
}
const returned = await pdf.save();
async function upload(bytes) {
  const body = new FormData();
  body.append('file', new Blob([bytes], { type: 'application/pdf' }), 'test-only-return.pdf');
  return request(`${route}/return`, { method: 'POST', body });
}
assert.equal((await upload(new TextEncoder().encode('%PDF-1.7\nmalformed'))).status, 400, 'Malformed return must fail');
const accepted = await upload(returned);
assert.equal(accepted.status, 200, `Return failed: ${await accepted.text()}`);
assert.equal((await upload(returned)).status, 409, 'Repeat return must fail');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [record] =
    await sql`select status, signing_method, signed_document_file_path, document_file_path from documents where id=${document.id}`;
  assert.equal(record.status, 'COMPLETED');
  assert.equal(record.signing_method, 'WET');
  assert.equal(record.document_file_path, document.documentFilePath);
  const audit = await sql`select action, details from document_audit_log where document_id=${document.id}`;
  assert.equal(audit.filter((item) => item.action === 'WET_SIGNATURE_RETURNED').length, 1);
  assert.equal(audit.filter((item) => item.action === 'WET_SIGNATURE_EXPORTED').length, 1);
  const hash = createHash('sha256').update(returned).digest('hex');
  assert.equal(audit.find((item) => item.action === 'WET_SIGNATURE_RETURNED').details.hash, hash);
  const key = new URL(record.signed_document_file_path).pathname.slice(1);
  const downloadPath = `/api/documents/proxy?proxy=true&documentId=${document.id}&key=${encodeURIComponent(key)}`;
  const downloaded = await request(downloadPath);
  assert.equal(downloaded.status, 200);
  const downloadedBytes = new Uint8Array(await downloaded.arrayBuffer());
  assert.deepEqual(downloadedBytes, returned, 'Completed download must preserve exact returned bytes');
  assert.deepEqual(
    new Uint8Array(await (await request(route)).arrayBuffer()),
    original,
    'Print packet must preserve original bytes',
  );
  const anonymous = await fetch(base + downloadPath, { redirect: 'manual' });
  assert.ok([401, 403, 404].includes(anonymous.status), 'Anonymous completed download must fail');
  await mkdir('tmp/pdfs', { recursive: true });
  await writeFile('tmp/pdfs/local-wet-sign-return.pdf', downloadedBytes);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        documentId: document.id,
        pages: pdf.getPageCount(),
        returnHash: hash,
        checks: [
          'local authentication',
          'draft creation',
          'wet export',
          'malformed rejection',
          'return completion',
          'duplicate rejection',
          'audit hash',
          'exact completed download',
          'unchanged original',
          'anonymous denial',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
