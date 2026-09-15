export function allowedEmailDomains(value = process.env.AUTH_ALLOWED_EMAIL_DOMAINS || ''): string[] {
  return value
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailDomainAllowed(email: string | null | undefined, configuredDomains?: string): boolean {
  const allowedDomains = allowedEmailDomains(configuredDomains);
  if (allowedDomains.length === 0) return true;

  const separator = email?.lastIndexOf('@') ?? -1;
  if (!email || separator <= 0 || separator === email.length - 1) return false;
  const domain = email.slice(separator + 1).toLowerCase();
  return allowedDomains.includes(domain);
}
