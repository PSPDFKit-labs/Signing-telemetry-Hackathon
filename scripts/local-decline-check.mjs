import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { request, post } = await localTestSession();
const { templates } = await (await request('/api/templates')).json();
const template = templates.find((item) => item.isSystem);
const created = await post('/api/documents', {
  name: 'TEST ONLY - decline state guards',
  templateId: template.id,
  documentFilePath: template.templateFilePath,
});
assert.equal(created.status, 200);
const { document } = await created.json();
const recipients = Array.from({ length: 3 }, (_, index) => ({
  id: randomUUID(),
  name: `Decline Test ${index}`,
  email: `decline-${index}@resident-demo.test`,
}));
assert.equal((await post(`/api/documents/${document.id}/recipients`, { recipients })).status, 200);
const tokens = recipients.map(() => randomBytes(32).toString('base64url'));
const ids = recipients.map(() => randomUUID());
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  // Synthetic request states test preservation, not authentic signature execution.
  await sql`update documents set status='IN_PROGRESS' where id=${document.id}`;
  for (const [index, recipient] of recipients.entries()) {
    const hash = `sha256:${createHash('sha256').update(tokens[index]).digest('hex')}`;
    await sql`insert into signature_requests (id, document_id, participant_id, signature_type, status, access_token, requested_at)
      values (${ids[index]}, ${document.id}, ${recipient.id}, 'ELECTRONIC', ${index === 0 ? 'SIGNED' : 'PENDING'}, ${hash}, now())`;
  }
  const payload = { token: tokens[1], signatureRequestId: ids[1] };
  await sql`update documents set deleted_at=now() where id=${document.id}`;
  assert.equal((await post('/api/sign/decline', payload)).status, 409);
  await sql`update documents set deleted_at=null, expires_at='2020-01-01' where id=${document.id}`;
  assert.equal((await post('/api/sign/decline', payload)).status, 409);
  await sql`update documents set expires_at=null, signing_method='WET' where id=${document.id}`;
  assert.equal((await post('/api/sign/decline', payload)).status, 409);
  await sql`update documents set signing_method='ELECTRONIC' where id=${document.id}`;
  assert.equal((await post('/api/sign/decline', { token: tokens[0], signatureRequestId: ids[0] })).status, 409);
  const response = await post('/api/sign/decline', payload);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).notificationDelivered, false);
  const rows = await sql`select id, status, access_token from signature_requests where document_id=${document.id}`;
  assert.equal(rows.find((row) => row.id === ids[0]).status, 'SIGNED');
  assert.ok(rows.find((row) => row.id === ids[0]).access_token);
  assert.equal(rows.find((row) => row.id === ids[1]).status, 'DECLINED');
  assert.equal(rows.find((row) => row.id === ids[1]).access_token, null);
  assert.equal(rows.find((row) => row.id === ids[2]).status, 'CANCELLED');
  assert.equal(rows.find((row) => row.id === ids[2]).access_token, null);
  assert.equal((await post('/api/sign/decline', payload)).status, 404);
  const logs =
    await sql`select id from document_audit_log where document_id=${document.id} and action='DOCUMENT_DECLINED'`;
  assert.equal(logs.length, 1);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        documentId: document.id,
        checks: [
          'deleted/expired/wet guards',
          'signed request cannot decline',
          'signed participant preserved',
          'pending peer cancelled and tokens revoked',
          'single decline audit',
          'no false email delivery claim',
          'revoked link rejected',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await sql`update documents set deleted_at=now() where id=${document.id}`;
  await sql.end();
}
