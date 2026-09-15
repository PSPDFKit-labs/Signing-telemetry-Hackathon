import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { request, post } = await localTestSession();
assert.ok(!process.env.NUTRIENT_API_KEY, 'This check expects deliberately deferred finalization');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  // Reuse the real viewer-exported TEST ONLY mark, never a person's signature.
  const [capture] = await sql`select a.annotation_data, d.template_id, d.document_file_path
    from document_annotations a join documents d on d.id=a.document_id
    where d.id='c9b95992-4d87-4c71-b6a2-0a86cdf02689' and d.name like 'TEST ONLY%'`;
  assert.ok(capture, 'The documented browser signature fixture is required');
  const captured = capture.annotation_data;
  const widget = captured.annotations.find((item) => item.type === 'pspdfkit/widget');
  const signature = captured.annotations.find((item) => item.type === 'pspdfkit/image');
  assert.ok(widget && signature);
  const results = [];
  for (const sequential of [true, false]) {
    const create = await post('/api/documents', {
      name: `TEST ONLY - ${sequential ? 'sequential' : 'parallel'} signing`,
      documentFilePath: capture.document_file_path,
      templateId: capture.template_id,
      requireSequentialSigning: sequential,
    });
    assert.equal(create.status, 200);
    const { document } = await create.json();
    const recipients = [0, 1].map((index) => ({
      id: randomUUID(),
      name: `Multi Test ${index}`,
      email: `multi-${index}@resident-demo.test`,
      signingOrder: index,
    }));
    assert.equal((await post(`/api/documents/${document.id}/recipients`, { recipients })).status, 200);
    const widgets = recipients.map((recipient, index) => ({
      ...widget,
      id: randomUUID(),
      formFieldName: `signature_${index}`,
      bbox: [widget.bbox[0], widget.bbox[1] + index * 120, widget.bbox[2], widget.bbox[3]],
      customData: { type: 'signature', signerID: recipient.id, recipientId: recipient.id },
    }));
    const canonical = {
      format: captured.format,
      annotations: widgets,
      formFields: widgets.map((item) => ({
        v: 1,
        name: item.formFieldName,
        label: item.formFieldName,
        type: 'pspdfkit/form-field/signature',
        annotationIds: [item.id],
      })),
    };
    assert.equal((await post(`/api/documents/${document.id}/fields`, { annotationData: canonical })).status, 200);
    const sent = await post(`/api/documents/${document.id}/send`, { finalizationMode: 'ELECTRONIC' });
    assert.equal(sent.status, 200);
    assert.equal((await sent.json()).emailsSent, 0);
    async function open(index) {
      // Advancing the sequential queue may rotate the same token concurrently.
      // Retry only the API's explicit compare-and-swap conflict, never an order denial.
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await post(`/api/documents/${document.id}/embed-session`, {
          participantId: recipients[index].id,
        });
        const result = await response.json();
        if (response.status === 409 && result.error === 'Signing request changed; create a new embed session') continue;
        assert.equal(response.status, 200, result.error);
        return {
          token: new URL(result.embedUrl).pathname.split('/').at(-1),
          signatureRequestId: result.signatureRequestId,
        };
      }
      throw new Error('Embed token kept changing after three attempts');
    }
    function payload(index) {
      return {
        format: captured.format,
        annotations: [
          {
            ...signature,
            id: `test-mark-${index}`,
            bbox: [signature.bbox[0], signature.bbox[1] + index * 120, signature.bbox[2], signature.bbox[3]],
            customData: { signerID: recipients[index].id, recipientId: recipients[index].id },
          },
        ],
        attachments: captured.attachments,
      };
    }
    const first = await open(0);
    const invalid = await post('/api/sign/submit', { ...first, instantJSON: payload(1) });
    assert.equal(invalid.status, 422, 'Another recipient mark must not satisfy this signer');
    if (sequential) {
      assert.equal(
        (await post(`/api/documents/${document.id}/embed-session`, { participantId: recipients[1].id })).status,
        409,
      );
      const firstSubmit = await post('/api/sign/submit', { ...first, instantJSON: payload(0) });
      assert.equal(firstSubmit.status, 200);
      assert.equal((await firstSubmit.json()).allSigned, false);
      const second = await open(1);
      const secondSubmit = await post('/api/sign/submit', { ...second, instantJSON: payload(1) });
      assert.equal(secondSubmit.status, 202);
      assert.equal((await secondSubmit.json()).finalizationPending, true);
    } else {
      const second = await open(1);
      const submitted = await Promise.all([
        post('/api/sign/submit', { ...first, instantJSON: payload(0) }),
        post('/api/sign/submit', { ...second, instantJSON: payload(1) }),
      ]);
      assert.deepEqual(submitted.map((item) => item.status).sort(), [200, 202]);
    }
    const saved = await (await request(`/api/documents/${document.id}/fields`)).json();
    const merged = saved.annotations[0].annotationData;
    assert.equal(merged.annotations.filter((item) => item.type === 'pspdfkit/widget').length, 2);
    assert.equal(merged.annotations.filter((item) => item.type === 'pspdfkit/image').length, 2);
    for (const index of [0, 1])
      assert.deepEqual(
        merged.annotations.find((item) => item.id === `test-mark-${index}`),
        payload(index).annotations[0],
      );
    const rows = await sql`select status, access_token from signature_requests where document_id=${document.id}`;
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.status === 'SIGNED' && row.access_token === null));
    const [record] = await sql`select status, signed_document_file_path from documents where id=${document.id}`;
    assert.equal(record.status, 'IN_PROGRESS');
    assert.equal(record.signed_document_file_path, null);
    const audit =
      await sql`select id from document_audit_log where document_id=${document.id} and action='DOCUMENT_SIGNED'`;
    assert.equal(audit.length, 2);
    results.push({ documentId: document.id, routing: sequential ? 'sequential' : 'parallel', result: 'PASS' });
  }
  console.log(
    JSON.stringify(
      {
        results,
        checks: [
          'real send endpoint',
          'sequential activation',
          'recipient isolation',
          'concurrent parallel submissions',
          'both captured marks preserved',
          'two signed requests and audit events',
          'tokens revoked',
          'finalization remains pending',
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
