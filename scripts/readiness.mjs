import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });
const present = (key) => Boolean(process.env[key]?.trim());
const groups = [
  ['Database', ['DATABASE_URL']],
  ['Session signing', ['AUTH_SECRET']],
  ['PDF storage', ['AWS_REGION', 'AWS_S3_BUCKET_NAME', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']],
  ['Viewer license', ['NEXT_PUBLIC_NUTRIENT_VIEWER_LICENSE_KEY']],
  ['Trusted PDF finalization', ['NUTRIENT_API_KEY']],
  ['Application address', ['NEXT_PUBLIC_APP_URL']],
  ['Email sender', ['EMAIL_FROM']],
];
let missing = 0;
for (const [label, keys] of groups) {
  const absent = keys.filter((key) => !present(key));
  if (absent.length) missing++;
  console.log(`${absent.length ? 'MISSING' : 'CONFIGURED'} ${label}${absent.length ? `: ${absent.join(', ')}` : ''}`);
}
const oauth =
  (present('AUTH_GOOGLE_ID') && present('AUTH_GOOGLE_SECRET')) ||
  (present('AUTH_MICROSOFT_ENTRA_ID_ID') &&
    present('AUTH_MICROSOFT_ENTRA_ID_SECRET') &&
    present('AUTH_MICROSOFT_ENTRA_ID_ISSUER'));
const email = present('RESEND_KEY') || present('AUTH_SENDGRID_KEY');
for (const [label, ready] of [
  ['OAuth provider', oauth],
  ['Email delivery provider', email],
]) {
  if (!ready) missing++;
  console.log(`${ready ? 'CONFIGURED' : 'MISSING'} ${label}`);
}
if (process.argv.includes('--production')) {
  const ready = present('UPSTASH_REDIS_REST_URL') && present('UPSTASH_REDIS_REST_TOKEN');
  if (!ready) missing++;
  console.log(`${ready ? 'CONFIGURED' : 'MISSING'} Public signing rate limiter`);
  const https = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://');
  if (!https) missing++;
  console.log(`${https ? 'CONFIGURED' : 'MISSING'} HTTPS application address`);
}
console.log(
  'Configuration presence only. Live sign-in, delivery, PDF output and embedded signing must still be verified.',
);
process.exitCode = missing ? 1 : 0;
