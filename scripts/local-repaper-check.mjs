import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { request, post } = await localTestSession();
const { templates } = await (await request('/api/templates')).json();
const template = templates.find((item) => item.isSystem && item.name === 'Service Agreement');
assert.ok(template);
const created = await post('/api/documents', {
  name: 'TEST ONLY - bulk repapering source',
  templateId: template.id,
  documentFilePath: template.templateFilePath,
});
assert.equal(created.status, 200);
const { document } = await created.json();
const participantId = randomUUID();
assert.equal(
  (
    await post(`/api/documents/${document.id}/recipients`, {
      recipients: [{ id: participantId, name: 'Template Resident', email: 'template@resident-demo.test' }],
    })
  ).status,
  200,
);
const annotationData = {
  format: 'https://pspdfkit.com/instant-json/v1',
  annotations: [
    {
      v: 2,
      id: '01M226EFKG62GW2STF5G1KPZF4',
      type: 'pspdfkit/widget',
      pageIndex: 0,
      bbox: [100, 100, 150, 50],
      opacity: 1,
      rotation: 0,
      createdAt: '2026-09-09T04:20:48Z',
      updatedAt: '2026-09-09T04:20:48Z',
      borderStyle: 'solid',
      borderWidth: 1,
      formFieldName: 'test-signature',
      customData: {
        signerID: participantId,
        recipientId: participantId,
        signerName: 'Template Resident',
        signerEmail: 'template@resident-demo.test',
        type: 'signature',
      },
    },
  ],
  formFields: [
    {
      v: 1,
      name: 'test-signature',
      label: 'Test signature',
      id: '01M226EFM2XVZAA887TEK66CF5',
      type: 'pspdfkit/form-field/signature',
      annotationIds: ['01M226EFKG62GW2STF5G1KPZF4'],
    },
  ],
};
assert.equal((await post(`/api/documents/${document.id}/fields`, { annotationData })).status, 200);
const recipients = Array.from({ length: 25 }, (_, index) => ({
  name: `Test Resident ${index + 1}`,
  email: `repaper-${index + 1}@resident-demo.test`,
}));
const route = `/api/documents/${document.id}/repaper`;
const batchId = randomUUID();
const body = { batchId, recipients, finalizationMode: 'ELECTRONIC' };
assert.equal((await post(route, { ...body, recipients: [{ name: 'Bad', email: 'invalid' }] })).status, 400);
assert.equal(
  (
    await post(route, {
      ...body,
      recipients: [recipients[0], { ...recipients[0], email: recipients[0].email.toUpperCase() }],
    })
  ).status,
  400,
);
assert.equal((await post(route, { ...body, recipients: Array(501).fill(recipients[0]) })).status, 400);
assert.equal((await post(route, { ...body, signingMethod: 'WET' })).status, 409);
const responses = await Promise.all([post(route, body), post(route, body)]);
assert.ok(responses.every((response) => response.status === 200));
const outcomes = await Promise.all(responses.map((response) => response.json()));
assert.equal(outcomes.filter((result) => result.alreadyCreated).length, 1);
const initial = outcomes.find((result) => !result.alreadyCreated);
assert.equal(initial.created, 25);
assert.equal(initial.emailsSent, 0);
assert.equal(initial.emailsExpected, 25);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const rows = await sql`select d.id, d.status, d.document_file_path, d.finalization_mode, d.repapering_index,
    p.id as participant_id, u.email, a.annotation_data, r.access_token
    from documents d join document_participants p on p.document_id=d.id
    join "user" u on u.id=p.user_id join document_annotations a on a.document_id=d.id
    join signature_requests r on r.document_id=d.id and r.participant_id=p.id
    where d.repapering_batch_id=${batchId} order by d.repapering_index`;
  assert.equal(rows.length, 25);
  assert.equal(new Set(rows.map((row) => row.id)).size, 25);
  assert.equal(new Set(rows.map((row) => row.participant_id)).size, 25);
  assert.equal(new Set(rows.map((row) => row.access_token)).size, 25);
  for (const [index, row] of rows.entries()) {
    assert.equal(row.email, recipients[index].email);
    assert.equal(row.status, 'PENDING');
    assert.equal(row.finalization_mode, 'ELECTRONIC');
    assert.equal(row.document_file_path, document.documentFilePath);
    assert.equal(row.annotation_data.annotations[0].customData.signerID, row.participant_id);
    assert.equal(row.annotation_data.annotations[0].customData.recipientId, row.participant_id);
    assert.equal(row.annotation_data.annotations[0].customData.signerEmail, row.email);
    assert.equal(JSON.stringify(row.annotation_data).includes(participantId), false);
    assert.match(row.access_token, /^sha256:[a-f0-9]{64}$/);
  }
  const [source] = await sql`select status from documents where id=${document.id}`;
  assert.equal(source.status, 'DRAFT');
  const sourceAnnotations = await (await request(`/api/documents/${document.id}/fields`)).json();
  assert.deepEqual(sourceAnnotations.annotations[0].annotationData, annotationData);
  const logs =
    await sql`select action from document_audit_log where document_id=${document.id} and action='REPAPERING_BATCH_CREATED'`;
  assert.equal(logs.length, 1);
  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        sourceDocumentId: document.id,
        batchId,
        envelopeCount: rows.length,
        checks: [
          'invalid and duplicate recipients rejected',
          '501-recipient batch rejected',
          'wet batch rejected',
          'concurrent retry idempotency',
          '25 isolated envelopes and field owners',
          'unique hashed tokens',
          'source unchanged',
          'single batch audit',
          'honest zero-email delivery count',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
