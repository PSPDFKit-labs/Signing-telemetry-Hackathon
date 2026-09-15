import { LoginPageContent } from '@/components/auth/login-page-content';
import { isLocalDemo } from '@/lib/local-demo';

export default function LoginPage() {
  return (
    <LoginPageContent
      localDemo={isLocalDemo()}
      googleConfigured={Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)}
      microsoftConfigured={Boolean(
        process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      )}
    />
  );
}
