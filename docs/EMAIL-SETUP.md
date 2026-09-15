# Email Service Setup - Resend

This document covers the email configuration for Nutrient Sign using Resend.

## Why Resend?

✅ **3,000 emails/month free** (vs SendGrid's expired trial)
✅ **Better developer experience** - Simple API, great documentation
✅ **Fast delivery** - Direct integration with major email providers
✅ **Built for developers** - Created by the Vercel team

---

## Quick Start

### 1. Get Your API Key

Get your API key from [Resend Dashboard](https://resend.com/api-keys):
```bash
RESEND_KEY="<your-resend-api-key>"
```

### 2. Set Sender Email

**Current (Development):**
```bash
EMAIL_FROM="onboarding@resend.dev"
```

This works immediately without any verification - perfect for testing!

**Production:**
```bash
EMAIL_FROM="noreply@jonaddams.com"  # After domain verification
```

### 3. Set Application URL

```bash
NEXT_PUBLIC_APP_URL="http://localhost:3000"           # Local
NEXT_PUBLIC_APP_URL="https://sign-sage.vercel.app"    # Production
```

---

## Testing Email Locally

Run the test script:

```bash
npx tsx scripts/test-email.ts
```

Expected output:
```
🔍 Testing Email Service Configuration...

Environment Variables:
  RESEND_KEY: ✅ Set
  EMAIL_FROM: onboarding@resend.dev
  NEXT_PUBLIC_APP_URL: ✅ Set

📧 Email Service: Resend

✅ Email sent successfully!
```

---

## Production Domain Setup

When you're ready to use your custom domain for emails:

### Step 1: Add Domain to Resend

1. Go to [Resend Domains](https://resend.com/domains)
2. Click **"Add Domain"**
3. Enter: `jonaddams.com` (or your domain)

### Step 2: Add DNS Records

Resend will provide 3 DNS records to add:

**Example records (yours will be different):**

```
Type: TXT
Name: resend._domainkey
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

Add these to your DNS provider (Cloudflare, Namecheap, etc.)

### Step 3: Verify

- Wait 5-10 minutes for DNS propagation
- Resend will automatically verify
- You'll see a green checkmark when verified

### Step 4: Update Environment

```bash
# Local
EMAIL_FROM="noreply@jonaddams.com"

# Vercel (Production)
vercel env add EMAIL_FROM production
# Enter: noreply@jonaddams.com
```

### Step 5: Redeploy

```bash
git commit -am "chore: update email sender to custom domain"
git push origin main
```

---

## Email Templates

The app includes a beautiful HTML email template for signing requests.

**Preview:** Check the test email you received!

**Features:**
- ✅ Branded header with Nutrient Sign logo
- ✅ Clear call-to-action button
- ✅ Document name and sender
- ✅ Optional custom message
- ✅ Expiration date (if set)
- ✅ Mobile-responsive design

**Customize:** Edit `lib/email-service.ts` → `generateSigningEmail()`

---

## Email Workflow

### When Document is Sent:

1. **Document Send API** (`/api/documents/[id]/send`)
   - Creates signature requests
   - Generates secure access tokens
   - Sends emails to recipients

2. **Email Content:**
   ```
   Subject: [Custom subject or "Please sign this document"]

   Hi [Recipient Name],

   [Sender Name] has sent you a document to sign:

   📄 [Document Name]

   [Optional custom message]

   ⏰ Expires: [Date if set]

   [Review & Sign Document Button]
   → Links to: https://yourdomain.com/sign/[access-token]
   ```

3. **Notification Tracking:**
   - Success/failure logged in `document_notifications` table
   - Email delivery status tracked
   - Failed sends logged with error details

---

## Monitoring & Debugging

### Check Email Logs in Resend

1. Go to [Resend Dashboard](https://resend.com/emails)
2. View all sent emails
3. See delivery status, opens, clicks

### Check Application Logs

```bash
# Local development
# Look for these in your terminal:
[INFO] Email sent successfully via Resend { to: 'user@example.com', emailId: '...' }
[ERROR] Resend API error { message: '...' }

# Production (Vercel)
vercel logs --production
```

### Test Specific Email

```bash
# Quick test with curl
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer YOUR_RESEND_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "jonaddams@gmail.com",
    "subject": "Quick Test",
    "html": "<p>Testing!</p>"
  }'
```

---

## Troubleshooting

### "Domain not verified" Error

**Problem:** Using custom domain before verification
```json
{
  "statusCode": 403,
  "message": "The jonaddams.com domain is not verified"
}
```

**Solution:** Either:
1. Use `onboarding@resend.dev` temporarily
2. Complete domain verification (see above)

### Emails Going to Spam

**Causes:**
- Using `onboarding@resend.dev` in production
- Missing SPF/DKIM records
- No custom domain

**Solutions:**
1. ✅ Use verified custom domain
2. ✅ Add all DNS records from Resend
3. ✅ Test with [Mail Tester](https://www.mail-tester.com)

### Rate Limiting

**Free Tier Limits:**
- 100 emails per day
- 3,000 emails per month

**If exceeded:**
- Upgrade to Pro ($20/month = 50,000 emails)
- Or implement queuing/batching

---

## Cost Comparison

| Provider | Free Tier | Cost After |
|----------|-----------|------------|
| **Resend** | 3,000/month | $20/month (50K emails) |
| SendGrid | Trial expired | $20/month (40K emails) |
| AWS SES | 3,000 free/month | $0.10/1K emails |
| Mailgun | 5,000 first month | $35/month (50K emails) |

**Recommendation:** Start with Resend free tier. Upgrade when needed.

---

## API Reference

### Send Email (Internal)

```typescript
import { sendEmail } from '@/lib/email-service';

const success = await sendEmail({
  to: 'recipient@example.com',
  subject: 'Document Ready',
  html: '<p>Your document is ready!</p>',
  from: 'custom@yourdomain.com', // Optional, uses EMAIL_FROM if not provided
});
```

### Generate Signing Email Template

```typescript
import { generateSigningEmail } from '@/lib/email-service';

const html = generateSigningEmail({
  recipientName: 'John Doe',
  senderName: 'Jane Smith',
  documentName: 'Contract.pdf',
  signingUrl: 'https://app.com/sign/token-123',
  message: 'Please review and sign',  // Optional
  expiresAt: new Date('2026-01-21'),  // Optional
});
```

---

## Security Notes

### Access Tokens

- ✅ UUIDs generated with `crypto.randomUUID()`
- ✅ One token per recipient per document
- ✅ Tokens stored in `signature_requests` table
- ✅ Validated before allowing document access

### Email Headers

The app automatically includes:
- `X-Forwarded-For`: User's IP address
- `User-Agent`: Browser information
- Logged in `document_audit_log` table

### Best Practices

1. ✅ Don't log email content (PII)
2. ✅ Use HTTPS for all signing links
3. ✅ Set document expiration dates
4. ✅ Track email delivery status
5. ✅ Provide unsubscribe links (future)

---

## Next Steps

✅ Email service is configured and working
✅ Test email delivered successfully
⏭️ **Next:** Build recipient signing interface (`/sign/[token]`)

For questions or issues:
- [Resend Documentation](https://resend.com/docs)
- [Resend Support](https://resend.com/support)
