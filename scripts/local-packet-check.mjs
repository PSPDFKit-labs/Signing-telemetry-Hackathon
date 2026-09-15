import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { PDFDocument } from 'pdf-lib';
import postgres from 'postgres';

config({ path: '.env.local', quiet: true });
const base = 'http://127.0.0.1:3000';
assert.equal(process.env.LOCAL_DEMO, 'true');
assert.equal(process.env.NEXT_PUBLIC_APP_URL, base);
assert.equal(new URL(process.env.DATABASE_URL).hostname, '127.0.0.1');
assert.equal(new URL(process.env.DATABASE_URL).port, '54329');
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
async function post(path, body) {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
assert.equal(session.user?.email, 'coordinator@resident-demo.test');
const { templates } = await (await request('/api/templates')).json();
const selected = ['Service Agreement', 'Non-Disclosure Agreement'].map((name) =>
  templates.find((item) => item.name === name && item.isSystem),
);
assert.ok(selected.every(Boolean));
await mkdir('tmp/pdfs/packet', { recursive: true });
const sources = [];
for (const [index, template] of selected.entries()) {
  const key = new URL(template.templateFilePath).pathname.slice(1);
  const downloaded = await request(
    `/api/documents/proxy?proxy=true&templateId=${template.id}&key=${encodeURIComponent(key)}`,
  );
  assert.equal(downloaded.status, 200);
  const bytes = new Uint8Array(await downloaded.arrayBuffer());
  const body = new FormData();
  body.append('file', new Blob([bytes], { type: 'application/pdf' }), `${template.name}.pdf`);
  const upload = await request('/api/upload', { method: 'POST', body });
  assert.equal(upload.status, 200);
  const uploaded = await upload.json();
  const path = `tmp/pdfs/packet/source-${index}.pdf`;
  await writeFile(path, bytes);
  const pageCount = (await PDFDocument.load(bytes)).getPageCount();
  sources.push({ url: uploaded.url, name: `${template.name}.pdf`, size: bytes.length, pageCount, path });
}
assert.equal((await post('/api/documents/packet', { files: [] })).status, 400);
assert.equal((await post('/api/documents/packet', { files: Array(26).fill(sources[0]) })).status, 400);
assert.equal(
  (
    await post('/api/documents/packet', {
      files: [{ ...sources[0], url: sources[0].url.replace('/local-demo-coordinator/', '/someone-else/') }],
    })
  ).status,
  400,
);
const ordered = [...sources].reverse();
// Deliberately incorrect client sizes must not become authoritative manifest data.
const merged = await post('/api/documents/packet', {
  title: 'TEST ONLY - ordered packet',
  files: ordered.map((item) => ({ ...item, size: 1 })),
});
assert.equal(merged.status, 200);
const packet = await merged.json();
assert.equal(packet.packetManifest.documentCount, 2);
let offset = 0;
for (const [index, source] of ordered.entries()) {
  assert.deepEqual(packet.packetManifest.documents[index], {
    name: source.name,
    size: source.size,
    pageCount: source.pageCount,
    pageStart: offset + 1,
    pageEnd: offset + source.pageCount,
  });
  offset += source.pageCount;
}
const created = await post('/api/documents', {
  name: packet.name,
  documentFilePath: packet.url,
  size: packet.size,
  packetManifest: packet.packetManifest,
});
assert.equal(created.status, 200);
const { document } = await created.json();
const key = new URL(packet.url).pathname.slice(1);
const download = await request(
  `/api/documents/proxy?proxy=true&documentId=${document.id}&key=${encodeURIComponent(key)}`,
);
assert.equal(download.status, 200);
const bytes = new Uint8Array(await download.arrayBuffer());
assert.equal((await PDFDocument.load(bytes)).getPageCount(), offset);
await writeFile('tmp/pdfs/packet/combined.pdf', bytes);
// Compare each rendered page, not just PDF page counts or dimensions.
let targetPage = 1;
for (const [index, source] of ordered.entries()) {
  for (let page = 1; page <= source.pageCount; page++, targetPage++) {
    const sourcePrefix = `tmp/pdfs/packet/source-${index}-page-${page}`;
    const targetPrefix = `tmp/pdfs/packet/target-page-${targetPage}`;
    execFileSync('pdftoppm', [
      '-f',
      String(page),
      '-l',
      String(page),
      '-singlefile',
      '-scale-to',
      '1000',
      '-png',
      source.path,
      sourcePrefix,
    ]);
    execFileSync('pdftoppm', [
      '-f',
      String(targetPage),
      '-l',
      String(targetPage),
      '-singlefile',
      '-scale-to',
      '1000',
      '-png',
      'tmp/pdfs/packet/combined.pdf',
      targetPrefix,
    ]);
    assert.deepEqual(
      await readFile(`${sourcePrefix}.png`),
      await readFile(`${targetPrefix}.png`),
      `Packet page ${targetPage} must match its source`,
    );
  }
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [record] = await sql`select packet_manifest from documents where id=${document.id}`;
  assert.deepEqual(record.packet_manifest, packet.packetManifest);
} finally {
  await sql.end();
}
console.log(
  JSON.stringify(
    {
      result: 'PASS',
      documentId: document.id,
      pages: offset,
      hash: createHash('sha256').update(bytes).digest('hex'),
      checks: [
        'real PDF upload',
        'empty and oversized packet rejection',
        'foreign-owner rejection',
        'reordered page boundaries',
        'server-derived source sizes',
        'saved manifest',
        'page-by-page rendered equality',
      ],
    },
    null,
    2,
  ),
);
