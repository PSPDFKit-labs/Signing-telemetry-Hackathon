# Embedded signing integration

The embedded signing route exposes the same recipient-isolated signing flow as
the hosted signing page, without the application header. The parent application
creates a recipient-scoped signing URL through an authenticated owner API and
renders that URL in an iframe.

## 1. Allow the parent origin

Set the exact HTTPS origins that may frame the signing route. Do not include URL
paths or wildcards. This value is read while the Next.js deployment is built.
For local integration testing, HTTP is also supported for exact `localhost`,
`127.0.0.1`, and `[::1]` origins, including the parent application's port.
For example, `EMBED_ALLOWED_ORIGINS=http://127.0.0.1:3100` permits a separate
loopback parent. Restart the development server after changing this setting.
Insecure remote HTTP origins, credentials, paths, queries, and fragments are
not accepted.

```dotenv
EMBED_ALLOWED_ORIGINS=https://app.residentinterface.com,https://staging.residentinterface.com
```

Every other application route remains non-embeddable. If the variable is empty,
only a page on the same origin can frame the embedded route. The parent page
must also permit the iframe to send its origin as the referrer; a `no-referrer`
policy prevents lifecycle messages from being delivered.

## 2. Create an embed session

The signed-in document owner requests an URL for one pending signer. Either the
participant ID or signature request ID may be supplied.

```http
POST /api/documents/{documentId}/embed-session
Content-Type: application/json

{"participantId":"participant-id"}
```

The response contains `embedUrl`, `expiresAt`, the selected IDs, and the event
protocol. Creating a session rotates that recipient's signing token, so a
previous email or embedded URL for the same request stops working. Create the
session immediately before it is displayed and never log, persist, or send the
URL to analytics.

For sequential signing, the API returns `409` until earlier signers have
finished. It also rejects completed, declined, cancelled, wet-sign, or
non-signer requests.

## 3. Render and observe the iframe

```html
<iframe id="nutrient-sign" title="Sign document" allow="clipboard-write"></iframe>
<script>
  const iframe = document.querySelector('#nutrient-sign');
  iframe.src = embedSession.embedUrl;

  window.addEventListener('message', (event) => {
    if (event.origin !== new URL(embedSession.embedUrl).origin) return;
    if (event.source !== iframe.contentWindow) return;
    if (event.data?.source !== 'nutrient-sign' || event.data?.version !== 1) return;

    switch (event.data.type) {
      case 'completed':
      case 'declined':
        // Close the modal and refresh Resident Interface's agreement state.
        break;
      case 'error':
        // Show event.data.detail.message or offer a fresh session.
        break;
    }
  });
</script>
```

Messages never contain the signing token. Version 1 emits `ready`,
`viewer-ready`, `submitting`, `completed`, `declined`, and `error`. Embedded
completion and decline remain on the terminal state instead of navigating the
iframe to a standalone application page.

The parent must still reconcile final agreement state through its authenticated
backend. Browser events are user-interface notifications, not an authoritative
completion webhook.
