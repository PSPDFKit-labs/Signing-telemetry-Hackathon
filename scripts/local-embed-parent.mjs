// Test-only, loopback parent. Requires a second demo instance at port 3001
// with EMBED_ALLOWED_ORIGINS=http://127.0.0.1:3100 and the same local database.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { localTestSession } from './local-test-session.mjs';

const [documentId, participantId] = process.argv.slice(2);
const uuid = /^[0-9a-f-]{36}$/i;
assert.ok(uuid.test(documentId ?? '') && uuid.test(participantId ?? ''), 'Supply test document and participant UUIDs');
const { post } = await localTestSession();
const parent = 'http://127.0.0.1:3100';
const child = 'http://127.0.0.1:3001';
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<title>TEST ONLY — cross-origin signing parent</title>
<style>body{font:16px system-ui;margin:24px}iframe{width:100%;height:720px;border:1px solid #999}pre{white-space:pre-wrap}</style>
<h1>TEST ONLY — cross-origin signing parent</h1>
<p>This loopback harness observes lifecycle events. It does not certify PDF finalization.</p>
<button id="open">Open test signer</button><pre id="events" aria-live="polite"></pre>
<iframe id="signer" title="Embedded test signer"></iframe>
<script>
const frame=document.querySelector('#signer');
const output=document.querySelector('#events');
window.addEventListener('message',event=>{
  if(event.origin!==${JSON.stringify(child)}||event.source!==frame.contentWindow)return;
  if(event.data?.source!=='nutrient-sign'||event.data?.version!==1)return;
  output.textContent+=JSON.stringify(event.data)+'\\n';
});
document.querySelector('#open').onclick=async()=>{
  const response=await fetch('/session',{method:'POST'});
  const data=await response.json();
  if(!response.ok){output.textContent=data.error;return;}
  frame.src=data.embedUrl;
};
</script></html>`;
createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  if (request.method === 'GET' && request.url === '/') {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html);
    return;
  }
  if (request.method !== 'POST' || request.url !== '/session' || request.headers.origin !== parent) {
    response.writeHead(403).end();
    return;
  }
  try {
    const result = await post(`/api/documents/${documentId}/embed-session`, { participantId });
    const data = await result.json();
    if (result.ok) {
      const url = new URL(data.embedUrl);
      assert.equal(url.origin, 'http://127.0.0.1:3000');
      data.embedUrl = child + url.pathname;
    }
    response.writeHead(result.status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(data));
  } catch {
    response.writeHead(500, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Could not create test session' }));
  }
}).listen(3100, '127.0.0.1', () => console.log(`Test parent: ${parent}; document ${documentId}`));
