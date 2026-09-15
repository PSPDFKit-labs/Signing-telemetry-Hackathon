export function isLocalDemo(): boolean {
  if (process.env.LOCAL_DEMO !== 'true') return false;
  try {
    const app = new URL(process.env.NEXT_PUBLIC_APP_URL || '');
    const db = new URL(process.env.DATABASE_URL || '');
    const local = (host: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(host);
    return local(app.hostname) && local(db.hostname) && Boolean(process.env.LOCAL_DEMO_PASSWORD);
  } catch {
    return false;
  }
}
