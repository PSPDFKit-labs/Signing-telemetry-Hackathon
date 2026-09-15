export const SIGNING_EMBED_PROTOCOL = 'nutrient-sign';
export const SIGNING_EMBED_VERSION = 1;

export const SIGNING_EMBED_EVENT_TYPES = [
  'ready',
  'viewer-ready',
  'submitting',
  'completed',
  'declined',
  'error',
] as const;

export type SigningEmbedEventType = (typeof SIGNING_EMBED_EVENT_TYPES)[number];

export interface SigningEmbedMessage {
  source: typeof SIGNING_EMBED_PROTOCOL;
  version: typeof SIGNING_EMBED_VERSION;
  type: SigningEmbedEventType;
  documentId?: string;
  detail?: Record<string, unknown>;
}

export function parentOriginFromReferrer(referrer: string): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    const allowedProtocol = url.protocol === 'https:' ||
      (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    return allowedProtocol && !url.username && !url.password ? url.origin : null;
  } catch {
    return null;
  }
}

export function createSigningEmbedMessage(
  type: SigningEmbedEventType,
  documentId?: string,
  detail?: Record<string, unknown>,
): SigningEmbedMessage {
  return { source: SIGNING_EMBED_PROTOCOL, version: SIGNING_EMBED_VERSION, type, documentId, detail };
}

export function postSigningEmbedEvent(
  type: SigningEmbedEventType,
  documentId?: string,
  detail?: Record<string, unknown>,
): boolean {
  if (typeof window === 'undefined' || window.parent === window) return false;
  const targetOrigin = parentOriginFromReferrer(document.referrer);
  if (!targetOrigin) return false;
  window.parent.postMessage(createSigningEmbedMessage(type, documentId, detail), targetOrigin);
  return true;
}
