# Vercel Deployment Setup Guide

This guide covers all the environment variables needed to deploy the Nutrient Sign application to Vercel.

## Required Environment Variables

### 1. Authentication (Auth.js)

```bash
AUTH_SECRET="<generate with: npx auth secret>"
```

**OAuth Providers:**
```bash
# Google OAuth
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# Microsoft OAuth
AUTH_MICROSOFT_ENTRA_ID_ID="your-microsoft-client-id"
AUTH_MICROSOFT_ENTRA_ID_SECRET="your-microsoft-client-secret"
AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/common/v2.0"
```

### 2. Database (Vercel Postgres / Neon)

```bash
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

**Note:** Vercel Postgres will auto-populate this if you use their integration.

### 3. Email Service (Resend - Recommended)

```bash
# Resend API Key
RESEND_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxx"

# Sender Email Address
# For testing: use onboarding@resend.dev
# For production: use your verified domain (e.g., noreply@yourdomain.com)
EMAIL_FROM="onboarding@resend.dev"
```

**Alternative: SendGrid**
```bash
AUTH_SENDGRID_KEY="SG.xxxxxxxxxxxxxxxxxxxxxxxxx"
EMAIL_FROM="your-email@example.com"
```

### 4. Application URL

```bash
# Production URL (CRITICAL for email links)
NEXT_PUBLIC_APP_URL="https://sign-sage.vercel.app"
```

**Important:** This must be set to your production domain for email signing links to work correctly.

### 5. AWS S3 (File Storage)

```bash
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
AWS_REGION="us-east-1"
AWS_S3_BUCKET_NAME="nutrient-sign-app"
```

### 6. Nutrient Web SDK

```bash
NEXT_PUBLIC_NUTRIENT_SDK_VERSION="1.19.0"
NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY="your-license-key"
```

---

## Quick Setup in Vercel

### Option 1: Via Vercel Dashboard

1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable from the list above
4. Set the environment to **Production** (and optionally Preview/Development)
5. Redeploy your application

### Option 2: Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link your project
vercel link

# Add environment variables
vercel env add RESEND_KEY production
vercel env add EMAIL_FROM production
vercel env add NEXT_PUBLIC_APP_URL production
# ... repeat for all variables

# Pull environment variables to local
vercel env pull .env.local
```

---

## Email Service Setup (Resend)

### Development/Testing

Use Resend's default test domain:
```bash
EMAIL_FROM="onboarding@resend.dev"
```

This allows immediate testing without domain verification.

### Production

1. **Add Your Domain to Resend:**
   - Go to [Resend Domains](https://resend.com/domains)
   - Click "Add Domain"
   - Enter your domain (e.g., `jonaddams.com`)

2. **Verify Domain:**
   - Add the DNS records provided by Resend
   - Wait for verification (usually 5-10 minutes)

3. **Update Environment Variable:**
   ```bash
   EMAIL_FROM="noreply@jonaddams.com"
   ```

4. **Redeploy:**
   - Push changes or manually redeploy in Vercel

### Resend Pricing

- **Free Tier:** 3,000 emails/month, 100 emails/day
- **Pro:** $20/month for 50,000 emails
- Perfect for most document signing workflows

---

## Database Setup (Vercel Postgres)

### If using Vercel Postgres:

1. Go to **Storage** in Vercel Dashboard
2. Create new **Postgres** database
3. Connect to your project
4. Copy the `DATABASE_URL` (auto-populated)

### If using external Neon/Supabase:

1. Create database in Neon/Supabase
2. Copy the connection string
3. Add as `DATABASE_URL` in Vercel environment variables

---

## AWS S3 Setup

The app uses S3 for document storage. Ensure:

1. **Bucket exists:** `nutrient-sign-app` (or your bucket name)
2. **CORS configured:** Already set in your bucket
3. **IAM permissions:** The access key has `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`

---

## Post-Deployment Verification

After deploying, test the following:

### 1. Authentication
- [ ] Google OAuth login works
- [ ] Microsoft OAuth login works
- [ ] User session persists

### 2. File Upload
- [ ] Documents can be uploaded
- [ ] Files appear in S3 bucket
- [ ] Presigned URLs work

### 3. Email Delivery
- [ ] Test document sending
- [ ] Check email arrives
- [ ] Verify signing link works

### 4. Database
- [ ] Documents are saved
- [ ] Recipients are created
- [ ] Audit logs are populated

---

## Troubleshooting

### Emails Not Sending

1. **Check Resend Key:**
   ```bash
   curl -X POST 'https://api.resend.com/emails' \
     -H 'Authorization: Bearer YOUR_KEY' \
     -H 'Content-Type: application/json' \
     -d '{"from":"onboarding@resend.dev","to":"test@example.com","subject":"Test","html":"<p>Test</p>"}'
   ```

2. **Verify EMAIL_FROM:**
   - Must be `onboarding@resend.dev` OR
   - A verified domain in your Resend account

3. **Check Logs:**
   - Vercel Function Logs will show email errors
   - Search for "Resend API error"

### Database Connection Issues

1. **Test Connection:**
   ```bash
   psql "DATABASE_URL_HERE"
   ```

2. **Check SSL Mode:**
   - Connection string should end with `?sslmode=require`

3. **Verify Tables Exist:**
   - Run migrations if needed
   - Check `documents`, `users`, `documentParticipants` tables

### S3 Upload Failures

1. **Test Credentials:**
   ```bash
   aws s3 ls s3://nutrient-sign-app --profile your-profile
   ```

2. **Check CORS:**
   - Should allow `PUT` and `POST` from your domain
   - Origin should include your Vercel domain

---

## Environment Variables Checklist

Copy this checklist to ensure all variables are set:

```bash
# Authentication
[ ] AUTH_SECRET
[ ] AUTH_GOOGLE_ID
[ ] AUTH_GOOGLE_SECRET
[ ] AUTH_MICROSOFT_ENTRA_ID_ID
[ ] AUTH_MICROSOFT_ENTRA_ID_SECRET
[ ] AUTH_MICROSOFT_ENTRA_ID_ISSUER

# Database
[ ] DATABASE_URL

# Email
[ ] RESEND_KEY
[ ] EMAIL_FROM

# Application
[ ] NEXT_PUBLIC_APP_URL

# Storage
[ ] AWS_ACCESS_KEY_ID
[ ] AWS_SECRET_ACCESS_KEY
[ ] AWS_REGION
[ ] AWS_S3_BUCKET_NAME

# Nutrient
[ ] NEXT_PUBLIC_NUTRIENT_SDK_VERSION
[ ] NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY
```

---

## Next Steps

Once all environment variables are configured:

1. Deploy to Vercel: `vercel --prod`
2. Test authentication flow
3. Upload a test document
4. Send to a recipient
5. Verify email delivery
6. Complete signing workflow

For support, check:
- [Vercel Documentation](https://vercel.com/docs)
- [Resend Documentation](https://resend.com/docs)
- [Auth.js Documentation](https://authjs.dev)
