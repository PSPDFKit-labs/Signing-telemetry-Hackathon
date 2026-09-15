import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { request, post } = await localTestSession();
const { templates } = await (await request('/api/templates')).json();
const template = templates.find((item) => item.isSystem);
const created = await post('/api/documents', {
  name: 'TEST ONLY - cancellation acceptance', templateId: template.id,
  documentFilePath: template.templateFilePath,
});
assert.equal(created.status, 200);
const { document } = await created.json();
const recipients = [0, 1].map((i) => ({ id: randomUUID(), name: `Cancel Test ${i}`,
  email: `cancel-${i}@resident-demo.test`, signingOrder: i }));
assert.equal((await post(`/api/documents/${document.id}/recipients`, { recipients })).status, 200);
assert.equal((await post(`/api/documents/${document.id}/send`, { finalizationMode: 'ELECTRONIC' })).status, 200);
const opened = await post(`/api/documents/${document.id}/embed-session`, { participantId: recipients[1].id });
assert.equal(opened.status, 200);
const { embedUrl } = await opened.json();
const token = new URL(embedUrl).pathname.split('/').at(-1);
assert.equal((await post('/api/sign/verify-token', { token })).status, 200);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  // Synthetic signed peer tests preservation, not signature capture.
  await sql`update signature_requests set status='SIGNED', signed_at=now(), access_token=null
    where document_id=${document.id} and participant_id=${recipients[0].id}`;
  for (const state of ['COMPLETED', 'DECLINED']) {
    await sql`update documents set status=${state} where id=${document.id}`;
    assert.ok([400, 409].includes((await post(`/api/documents/${document.id}/cancel`, {})).status));
  }
  await sql`update documents set status='IN_PROGRESS', deleted_at=now() where id=${document.id}`;
  assert.equal((await post(`/api/documents/${document.id}/cancel`, {})).status, 404);
  await sql`update documents set deleted_at=null where id=${document.id}`;
  const responses = await Promise.all([0, 1].map(() => post(`/api/documents/${document.id}/cancel`, {
    reason: 'TEST ONLY - cancellation verification',
  })));
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
  const result = await responses.find((r) => r.status === 200).json();
  assert.equal(result.cancelledSignatureRequests, 1);
  assert.equal(result.emailsSent, 0);
  assert.equal((await post('/api/sign/verify-token', { token })).status, 404);
  const rows = await sql`select status,access_token is null as revoked from signature_requests where document_id=${document.id}`;
  assert.deepEqual(rows.map((r) => r.status).sort(), ['CANCELLED', 'SIGNED']);
  assert.ok(rows.every((r) => r.revoked));
  assert.equal((await sql`select id from document_audit_log where document_id=${document.id} and action='DOCUMENT_CANCELLED'`).length, 1);
  const [record] = await sql`select status from documents where id=${document.id}`;
  assert.equal(record.status, 'CANCELLED');
  console.log(JSON.stringify({ result: 'PASS', documentId: document.id,
    checks: ['valid link before cancellation', 'terminal/deleted guards', 'concurrent cancellation has one winner',
      'signed peer preserved', 'pending link revoked', 'one cancellation audit', 'zero delivered emails'] }, null, 2));
} finally {
  await sql.end();
}
