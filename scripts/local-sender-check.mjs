import assert from 'node:assert/strict';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { post } = await localTestSession();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [test] =
    await sql`select d.id, p.id as participant_id, owner.name as sender_name, recipient.name as recipient_name
    from documents d join document_participants p on p.document_id=d.id
    join "user" owner on owner.id=d.owner_id join "user" recipient on recipient.id=p.user_id
    where d.owner_id='local-demo-coordinator' and d.name like 'TEST ONLY - bulk repapering source%'
    and d.status='PENDING' and d.deleted_at is null and d.repapering_index=2
    order by d.created_at desc limit 1`;
  assert.ok(test, 'Run local-repaper-check.mjs first');
  assert.notEqual(test.sender_name, test.recipient_name);
  const embed = await post(`/api/documents/${test.id}/embed-session`, { participantId: test.participant_id });
  assert.equal(embed.status, 200);
  const { embedUrl } = await embed.json();
  const token = new URL(embedUrl).pathname.split('/').at(-1);
  const verified = await post('/api/sign/verify-token', { token });
  assert.equal(verified.status, 200);
  const data = await verified.json();
  assert.equal(data.sender.name, test.sender_name);
  assert.equal(data.recipient.name, test.recipient_name);
  assert.notEqual(data.sender.name, data.recipient.name);
  assert.equal(data.document.id, test.id);
  assert.equal(data.recipient.id, test.participant_id);
  assert.equal(data.finalizationAvailable, Boolean(process.env.NUTRIENT_API_KEY?.trim()));
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        documentId: test.id,
        checks: ['owner-derived sender name', 'separate recipient identity', 'recipient-scoped embed session'],
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
