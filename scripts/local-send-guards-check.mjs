import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { request, post } = await localTestSession();
const { templates } = await (await request('/api/templates')).json();
const template = templates.find((item) => item.isSystem);
const created = await post('/api/documents', {
  name: 'TEST ONLY - send lifecycle guards',
  templateId: template.id,
  documentFilePath: template.templateFilePath,
});
assert.equal(created.status, 200);
const { document } = await created.json();
assert.equal((await post(`/api/documents/${document.id}/recipients`, {
  recipients: [{ id: randomUUID(), name: 'Send Guard Test', email: 'send-guard@resident-demo.test' }],
})).status, 200);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const send = () => post(`/api/documents/${document.id}/send`, { finalizationMode: 'ELECTRONIC' });
try {
  for (const status of ['COMPLETED', 'DECLINED', 'CANCELLED', 'AWAITING_WET_SIGNATURE']) {
    await sql`update documents set status=${status} where id=${document.id}`;
    assert.equal((await send()).status, 409, status);
  }
  await sql`update documents set status='DRAFT', deleted_at=now() where id=${document.id}`;
  assert.equal((await send()).status, 404);
  await sql`update documents set deleted_at=null, signing_method='WET' where id=${document.id}`;
  assert.equal((await send()).status, 409);
  await sql`update documents set signing_method='ELECTRONIC', expires_at='2020-01-01' where id=${document.id}`;
  assert.equal((await send()).status, 410);
  assert.equal((await sql`select id from signature_requests where document_id=${document.id}`).length, 0);
  assert.equal((await sql`select id from document_audit_log where document_id=${document.id} and action='DOCUMENT_SENT'`).length, 0);
  await sql`update documents set expires_at=null where id=${document.id}`;
  const accepted = await send();
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).emailsSent, 0);
  const replay = await send();
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).alreadySent, true);
  assert.equal((await sql`select id from signature_requests where document_id=${document.id}`).length, 1);
  console.log(JSON.stringify({ result: 'PASS', documentId: document.id,
    checks: ['four terminal/wet states rejected', 'deleted rejected', 'wet method rejected',
      'expired rejected', 'rejected sends have no request or audit', 'valid send succeeds', 'replay is idempotent'] }, null, 2));
} finally {
  await sql`update documents set deleted_at=now() where id=${document.id}`;
  await sql.end();
}
