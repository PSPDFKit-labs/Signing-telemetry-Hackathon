import assert from 'node:assert/strict';
import { localTestSession } from './local-test-session.mjs';

const { request } = await localTestSession();

const templatesResponse = await request('/api/templates');
assert.equal(templatesResponse.status, 200, 'The template library did not respond');
const { templates } = await templatesResponse.json();
const agreement = templates.find((template) => template.name === 'Service Agreement' && template.isSystem);
assert.ok(agreement, 'The Service Agreement sample is missing');

const key = new URL(agreement.templateFilePath).pathname.slice(1);
const pdf = await request(`/api/documents/proxy?proxy=true&templateId=${agreement.id}&key=${encodeURIComponent(key)}`);
assert.equal(pdf.status, 200, 'The Service Agreement PDF could not be retrieved');
assert.match(pdf.headers.get('content-type') || '', /^application\/pdf/, 'The template response is not a PDF');
assert.ok((await pdf.arrayBuffer()).byteLength > 1_000, 'The template PDF is unexpectedly empty');

const mailbox = await fetch('http://127.0.0.1:8025/');
assert.equal(mailbox.status, 200, 'The local Mailpit inbox is unavailable');

console.log('✓ Local demo smoke check passed: sign-in, templates, PDF preview route, and Mailpit are ready.');
