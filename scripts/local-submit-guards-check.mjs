import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { request, post } = await localTestSession();
const { templates } = await (await request('/api/templates')).json();
const template = templates.find((item) => item.isSystem);
const create = await post('/api/documents', {
  name: 'TEST ONLY - submission lifecycle guards',
  templateId: template.id,
  documentFilePath: template.templateFilePath,
});
assert.equal(create.status, 200);
const { document } = await create.json();
const participantId = randomUUID();
assert.equal(
  (
    await post(`/api/documents/${document.id}/recipients`, {
      recipients: [{ id: participantId, name: 'Submit Guard Test', email: 'submit-guard@resident-demo.test' }],
    })
  ).status,
  200,
);
const token = randomBytes(32).toString('base64url');
const hash = `sha256:${createHash('sha256').update(token).digest('hex')}`;
const signatureRequestId = randomUUID();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const payload = { token, signatureRequestId, instantJSON: { annotations: [] } };
try {
  // A retained token in an inactive document is an adversarial fixture, not a real send.
  await sql`insert into signature_requests (id, document_id, participant_id, signature_type, status, access_token, requested_at)
    values (${signatureRequestId}, ${document.id}, ${participantId}, 'ELECTRONIC', 'PENDING', ${hash}, now())`;
  for (const status of ['DRAFT', 'COMPLETED', 'DECLINED', 'CANCELLED', 'AWAITING_WET_SIGNATURE']) {
    await sql`update documents set status=${status} where id=${document.id}`;
    assert.equal((await post('/api/sign/submit', payload)).status, 409, status);
    const [record] = await sql`select status from documents where id=${document.id}`;
    assert.equal(record.status, status);
  }
  await sql`update documents set status='PENDING', deleted_at=now() where id=${document.id}`;
  assert.equal((await post('/api/sign/submit', payload)).status, 409);
  await sql`update documents set deleted_at=null, signing_method='WET' where id=${document.id}`;
  assert.equal((await post('/api/sign/submit', payload)).status, 409);
  await sql`update documents set signing_method='ELECTRONIC', expires_at='2020-01-01' where id=${document.id}`;
  assert.equal((await post('/api/sign/submit', payload)).status, 410);
  await sql`update documents set expires_at=null where id=${document.id}`;
  await sql`update document_participants set access_level='VIEWER' where id=${participantId}`;
  assert.equal((await post('/api/sign/submit', payload)).status, 409);
  const [signed] =
    await sql`select status, signed_at, access_token from signature_requests where id=${signatureRequestId}`;
  assert.equal(signed.status, 'PENDING');
  assert.equal(signed.signed_at, null);
  assert.equal(signed.access_token, hash);
  const audit =
    await sql`select id from document_audit_log where document_id=${document.id} and action='DOCUMENT_SIGNED'`;
  assert.equal(audit.length, 0);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        documentId: document.id,
        checks: [
          'five inactive document states rejected',
          'deleted document rejected',
          'wet method rejected',
          'expired request rejected',
          'non-signer rejected',
          'no signature or audit mutation',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await sql`update documents set status='DRAFT', deleted_at=now() where id=${document.id}`;
  await sql.end();
}
