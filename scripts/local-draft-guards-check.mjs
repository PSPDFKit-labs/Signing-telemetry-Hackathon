import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { request, post } = await localTestSession();
const { templates } = await (await request('/api/templates')).json();
const template = templates.find((item) => item.isSystem);
const created = await post('/api/documents', {
  name: 'TEST ONLY - draft edit guards',
  templateId: template.id,
  documentFilePath: template.templateFilePath,
});
assert.equal(created.status, 200);
const { document } = await created.json();
const recipients = [{ id: randomUUID(), name: 'Guard Test', email: 'guard-test@resident-demo.test' }];
const annotationData = { annotations: [], formFields: [], testMarker: 'preserve original' };
assert.equal((await post(`/api/documents/${document.id}/recipients`, { recipients })).status, 200);
assert.equal((await post(`/api/documents/${document.id}/fields`, { annotationData })).status, 200);
const originalRecipients = await (await request(`/api/documents/${document.id}/recipients`)).json();
const originalFields = await (await request(`/api/documents/${document.id}/fields`)).json();
async function assertUnchanged() {
  assert.deepEqual(await (await request(`/api/documents/${document.id}/recipients`)).json(), originalRecipients);
  assert.deepEqual(await (await request(`/api/documents/${document.id}/fields`)).json(), originalFields);
}
// Force an insert failure after replacement starts: the original participants must survive.
const repeatedId = randomUUID();
const failed = await post(`/api/documents/${document.id}/recipients`, {
  recipients: [
    { ...recipients[0], id: repeatedId },
    { ...recipients[0], id: repeatedId },
  ],
});
assert.equal(failed.status, 500);
await assertUnchanged();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  // State fixtures isolate the edit guards; these are not evidence of actual signing completion.
  for (const status of ['PENDING', 'IN_PROGRESS', 'AWAITING_WET_SIGNATURE', 'COMPLETED', 'DECLINED', 'CANCELLED']) {
    await sql`update documents set status=${status} where id=${document.id}`;
    assert.equal(
      (await post(`/api/documents/${document.id}/recipients`, { recipients: [] })).status,
      409,
      `${status}: recipients`,
    );
    assert.equal(
      (
        await post(`/api/documents/${document.id}/fields`, {
          annotationData: { annotations: [], testMarker: 'overwrite attempt' },
        })
      ).status,
      409,
      `${status}: fields`,
    );
    await assertUnchanged();
  }
  await sql`update documents set status='DRAFT', deleted_at=now() where id=${document.id}`;
  assert.equal((await post(`/api/documents/${document.id}/recipients`, { recipients: [] })).status, 404);
  assert.equal((await post(`/api/documents/${document.id}/fields`, { annotationData })).status, 404);
  await assertUnchanged();
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        documentId: document.id,
        checks: [
          'draft edits work',
          'failed recipient replacement rolls back',
          'all six non-draft states reject recipient and field changes',
          'deleted draft rejects changes',
          'stored recipients and fields unchanged after rejection',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  // Leave only this disposable fixture in trash, without claiming it was ever signed.
  await sql`update documents set status='DRAFT', deleted_at=now() where id=${document.id}`;
  await sql.end();
}
