import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { localTestSession } from './local-test-session.mjs';

const { post } = await localTestSession();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const [source] = await sql`select a.annotation_data,d.template_id,d.document_file_path
    from document_annotations a join documents d on d.id=a.document_id
    where d.id='c9b95992-4d87-4c71-b6a2-0a86cdf02689'`;
  const widget = source.annotation_data.annotations.find((a) => a.type === 'pspdfkit/widget');
  assert.ok(widget);
  const created = await post('/api/documents', { name: 'TEST ONLY - browser sequential routing',
    documentFilePath: source.document_file_path, templateId: source.template_id, requireSequentialSigning: true });
  assert.equal(created.status, 200);
  const { document } = await created.json();
  const recipients = [0, 1].map((i) => ({ id: randomUUID(), name: `Browser Test ${i + 1}`,
    email: `browser-${i + 1}@resident-demo.test`, signingOrder: i }));
  assert.equal((await post(`/api/documents/${document.id}/recipients`, { recipients })).status, 200);
  const widgets = recipients.map((r, i) => ({ ...widget, id: randomUUID(),
    formFieldName: `browser_signature_${i + 1}`, bbox: [24, 24 + i * 120, 150, 50],
    customData: { type: 'signature', signerID: r.id, recipientId: r.id, signerName: r.name, signerEmail: r.email } }));
  assert.equal((await post(`/api/documents/${document.id}/fields`, { annotationData: {
    format: source.annotation_data.format, annotations: widgets,
    formFields: widgets.map((w) => ({ v: 1, name: w.formFieldName, label: w.formFieldName,
      type: 'pspdfkit/form-field/signature', annotationIds: [w.id] })),
  } })).status, 200);
  const sent = await post(`/api/documents/${document.id}/send`, { finalizationMode: 'ELECTRONIC' });
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).emailsSent, 0);
  assert.equal((await post(`/api/documents/${document.id}/embed-session`, { participantId: recipients[1].id })).status, 409);
  console.log(JSON.stringify({ documentId: document.id, recipients,
    nextSignerBlocked: true, note: 'Fixture only. Browser signing remains to be performed.' }, null, 2));
} finally { await sql.end(); }
