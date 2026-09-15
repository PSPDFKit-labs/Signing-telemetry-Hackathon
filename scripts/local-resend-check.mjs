import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { request, post } = await localTestSession();
const { templates } = await (await request('/api/templates')).json();
const template = templates.find((t) => t.isSystem);
const created = await post('/api/documents', { name: 'TEST ONLY - resend acceptance',
  templateId: template.id, documentFilePath: template.templateFilePath });
assert.equal(created.status, 200);
const { document } = await created.json();
const participantId = randomUUID();
assert.equal((await post(`/api/documents/${document.id}/recipients`, {
  recipients: [{ id: participantId, name: 'Resend Test', email: 'resend@resident-demo.test' }],
})).status, 200);
assert.equal((await post(`/api/documents/${document.id}/send`, { finalizationMode: 'ELECTRONIC' })).status, 200);
const opened = await post(`/api/documents/${document.id}/embed-session`, { participantId });
assert.equal(opened.status, 200);
const token = new URL((await opened.json()).embedUrl).pathname.split('/').at(-1);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const resent = await post(`/api/documents/${document.id}/resend`, {});
  assert.equal(resent.status, 200);
  assert.equal((await resent.json()).emailsSent, 0);
  assert.equal((await post('/api/sign/verify-token', { token })).status, 404);
  for (const status of ['DRAFT', 'COMPLETED', 'DECLINED', 'CANCELLED', 'AWAITING_WET_SIGNATURE']) {
    await sql`update documents set status=${status} where id=${document.id}`;
    assert.equal((await post(`/api/documents/${document.id}/resend`, {})).status, 409, status);
  }
  await sql`update documents set status='PENDING',deleted_at=now() where id=${document.id}`;
  assert.equal((await post(`/api/documents/${document.id}/resend`, {})).status, 404);
  await sql`update documents set deleted_at=null, signing_method='WET' where id=${document.id}`;
  assert.equal((await post(`/api/documents/${document.id}/resend`, {})).status, 409);
  await sql`update documents set signing_method='ELECTRONIC', expires_at='2020-01-01' where id=${document.id}`;
  assert.equal((await post(`/api/documents/${document.id}/resend`, {})).status, 410);
  const renewed = await post(`/api/documents/${document.id}/resend`, { expiresAt: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(renewed.status, 200);
  const race = await Promise.all([
    post(`/api/documents/${document.id}/resend`, {}),
    post(`/api/documents/${document.id}/cancel`, {}),
  ]);
  assert.ok([200, 409].includes(race[0].status));
  assert.equal(race[1].status, 200);
  const [record] = await sql`select status from documents where id=${document.id}`;
  assert.equal(record.status, 'CANCELLED');
  const [signature] = await sql`select status,access_token from signature_requests where document_id=${document.id}`;
  assert.equal(signature.status, 'CANCELLED');
  assert.equal(signature.access_token, null);
  console.log(JSON.stringify({ result: 'PASS', documentId: document.id,
    checks: ['resend revokes previous link', 'inactive/deleted/wet guards', 'expiration requires renewal',
      'explicit renewal succeeds', 'resend cannot resurrect concurrent cancellation', 'no email delivery'] }, null, 2));
} finally { await sql.end(); }
