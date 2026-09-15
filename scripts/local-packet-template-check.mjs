import assert from 'node:assert/strict';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { post, request } = await localTestSession();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [source] = await sql`select id, document_file_path, packet_manifest from documents
    where name like 'TEST ONLY%' and packet_manifest is not null and deleted_at is null
    order by created_at desc limit 1`;
  assert.ok(source, 'Run packet browser/API acceptance first');
  const saved = await post('/api/templates', { name: 'TEST ONLY - packet manifest reuse',
    file_url: source.document_file_path });
  assert.equal(saved.status, 200);
  const { template } = await saved.json();
  assert.deepEqual(template.packetManifest, source.packet_manifest);
  const { templates } = await (await request('/api/templates')).json();
  assert.deepEqual(templates.find((t) => t.id === template.id).packetManifest, source.packet_manifest);
  const created = await post('/api/documents', { name: 'TEST ONLY - reused packet provenance',
    templateId: template.id, documentFilePath: template.templateFilePath,
    packetManifest: { version: 999, documents: [] } });
  assert.equal(created.status, 200);
  const { document } = await created.json();
  const [stored] = await sql`select packet_manifest,document_file_path from documents where id=${document.id}`;
  assert.deepEqual(stored.packet_manifest, source.packet_manifest);
  assert.equal(stored.document_file_path, source.document_file_path);
  console.log(JSON.stringify({ result: 'PASS', templateId: template.id, documentId: document.id,
    checks: ['template snapshots source packet manifest', 'listing returns manifest',
      'reuse preserves page boundaries', 'client manifest override ignored', 'combined PDF unchanged'] }, null, 2));
} finally { await sql.end(); }
