import { eq } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { users } from '@/database/drizzle/auth-schema';
import {
  documentNotifications,
  documentParticipants,
  documents,
  signatureRequests,
} from '@/database/drizzle/document-signing-schema';
import { db } from '@/database/drizzle/drizzle';
import { escapeEmailHtml } from '@/lib/email-template-security';
import { logger } from './logger';

// Nutrient logo as base64 PNG (240x170, transparent background, ~1.3KB)
// Embedded as CID inline attachment for universal email client support
const NUTRIENT_LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAPAAAACqCAYAAACTQMIDAAAAAXNSR0IB2cksfwAAAARnQU1BAACxjwv8YQUAAAAgY0hSTQAAeiYAAICEAAD6AAAAgOgAAHUwAADqYAAAOpgAABdwnLpRPAAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+oCGBMZM67Wa3MAAAR3SURBVHja7d3dUdxAEEVh9RR5OBTHQKSOwaGQid9cZT+waFlp+uc7z4CGnnvUrUVIxwGgLJFxUT9/HO9nv+f3x/HLdmJaxqJyQYmMHTnLlLHoJC+RMS1j0a2oRMakjEXnwpKYvN0zFt0LS2Lyds5YTCgsicnbNWMxpbAkJm/HjK1JhQW6ZX0pLuxtXWJqYY3S5O2QsWXrgbpcLnDWscYojQ4Z04FBFB0YQDuBjakwHVzrwFJc2EMdGACBARAYIDAAAgMgMAACAwTugv9IsocEVlxgmwNGaEAHdmYEWgpMFEzNmCdyAPiU2x4rm+m/RkwFPZmYsXEdmLz21jWw4gIpsu7VKjBKF86Yl5uBxIUz5vWiIHHhjHnBN0hcOGPRtcjExYSMRbciExd3iJwlZ9GlyMSFjAEAgMEj9KTRzVgGArvWAoGxU1oyg8CNxCUxCNxAXiKDwA3kJTEIXFxeEoPAxeUlMQhcXF4Sg8DF5SUxjsNjZQEdWPfVhaEDA9CBZ3VfXVgHBkBgAAQ2PgMEdoIBgQEQGACBARAY6MPbd775qx+cuMkAE7nDj7hqUd1krvAprxNl/Zyc3cPYFeBqYSMwMvoRu4NbJXTZBSZvz1w82te1O7RVbkAgCDL6sTKI5S4ikPe5Y60sQpHYdEDe88dcmURynQnynjv2yiaQTgzyfn0N7sQq3oVNBbOJrJ0vezA9F1r3zbD3K+vYapSGLD5ekxG6aPfTfUHgohKRF3+vgf3pptaIRV7jsw5cVCry4n/elOC1cl1xxiYuCFxQZOKCwAnG6jMykxYEHnqNjHn4EAvQgTGNzy4LTBwERiFhH30toQmMAuI++hlEJjAKiUvk6/EhFm6R986fT2CQt8lxuhOZi2nU6ilvtT3O7IcOjK0h1Ylf0IEzFlL3nSWRRyg9Vy8dmLzv1lGXlfEMqPsi4/VmxrUshdJ9rafuiWSRB6jbXCLTmdAJRLerkINMfqwsBSQvdOLzx1wZFklekPi5Y8XOkYG4xucO2djpR+xYKHEJ3DEjO/yIOxdKXAJPyMqdfsSVCyYsgU1p1/oR4kxgAtfFvdAAgQEQGACBgSn4EGso7oXWgQEQGIARGi3GaOOzDgwQGIARGsZo4zOB0V1i8hqhAR0YurDuS2CQmLwERmeJyUtgFBSZuARGUYnJS2AUFJm4BEYxmUkLAACM0OnGNSMa7rgkyJyzqFhQQkPGkgn8yj9ZEBlTMhadikpkTMtYdC0siTEhY9G1qCTGhJxF96KSmLydc7ZsKOx1XWJaYXVi8nbKWEwqLInJ2y1jnokFFD6ZrE6/jGskwkxDBwYKc/k1sNdYQsZ0YAAEBgjcYrQBOoz3S3FhD3VgAAQGQGCAwAAIDIDAAAj8D26lBIEBJ+Ft61uTiwvowAAIbPRCt728Y12LKIAO7IwNe9pVYMLACeUaPBcarZiWsVEjNHntcTe8Gwk6ceGceTshSFw4Z9G9uOQlceecRecCkxfdMxYdC0xcTMlZdCoycXGHyJlyFtULTVpMztgfC1hNn7UkT/sAAAAASUVORK5CYII=';
const NUTRIENT_LOGO_CID = 'nutrient-logo@sign';

function emailLogo(): string {
  return `<span style="font-size: 24px; font-weight: 700; color: #1a1414; vertical-align: middle;">Resident Interface</span><span style="display: block; margin-top: 2px; font-size: 12px; color: #737373;">Agreement operations</span>`;
}

function emailHeader(): string {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1414; margin: 0; padding: 0; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            ${emailLogo()}
          </div>`;
}

function emailFooter(): string {
  return `<!-- Footer -->
          <div style="text-align: center; margin-top: 32px;">
            <p style="margin: 0; font-size: 12px; color: #a3a3a3;">
              This is an automated email from Nutrient Sign.<br>
              Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
    </html>`;
}

interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
}

/**
 * Send email using local SMTP, Resend, or SendGrid (in that order)
 * Automatically detects which service is configured
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, from, attachments } = options;

  const resendKey = process.env.RESEND_KEY;
  const sendGridKey = process.env.AUTH_SENDGRID_KEY;
  const smtpHost = process.env.SMTP_HOST?.trim();
  const emailFrom = from || process.env.EMAIL_FROM || 'noreply@nutrient.io';

  // Local evaluation uses Mailpit. It accepts SMTP then exposes messages only
  // on the loopback inbox; no test invitation leaves the machine.
  if (smtpHost) {
    return sendEmailViaSmtp({ to, subject, html, from: emailFrom, attachments }, smtpHost);
  }

  // Prefer Resend if configured
  if (resendKey) {
    return sendEmailViaResend({ to, subject, html, from: emailFrom, attachments }, resendKey);
  }

  // Fall back to SendGrid
  if (sendGridKey) {
    return sendEmailViaSendGrid({ to, subject, html, from: emailFrom, attachments }, sendGridKey);
  }

  logger.warn('No email service configured - email not sent', { to, subject });
  return false;
}

async function sendEmailViaSmtp(options: EmailOptions & { from: string }, host: string): Promise<boolean> {
  const { to, subject, html, from, attachments } = options;
  const configuredPort = Number(process.env.SMTP_PORT || '1025');
  const port = Number.isSafeInteger(configuredPort) && configuredPort > 0 ? configuredPort : 1025;

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } }
        : {}),
    });
    const result = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments: [
        {
          filename: 'nutrient-logo.png',
          content: Buffer.from(NUTRIENT_LOGO_BASE64, 'base64'),
          contentType: 'image/png',
          cid: NUTRIENT_LOGO_CID,
        },
        ...(attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.from(attachment.content, 'base64'),
          contentType: 'application/pdf',
        })) ?? []),
      ],
    });
    logger.info('Email accepted by SMTP service', { to, subject, messageId: result.messageId });
    return true;
  } catch (error) {
    logger.error('SMTP email delivery failed', error, { to, subject });
    return false;
  }
}

/**
 * Send email via Resend API
 */
async function sendEmailViaResend(options: EmailOptions & { from: string }, apiKey: string): Promise<boolean> {
  const { to, subject, html, from, attachments } = options;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        attachments: [
          // Inline logo (CID-referenced in HTML)
          {
            filename: 'nutrient-logo.png',
            content: NUTRIENT_LOGO_BASE64,
            content_type: 'image/png',
            content_id: NUTRIENT_LOGO_CID,
          },
          // File attachments (e.g. signed PDFs)
          ...(attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
          })) ?? []),
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Resend API error', new Error(errorText));
      return false;
    }

    const result = await response.json();
    logger.info('Email sent successfully via Resend', { to, subject, emailId: result.id });
    return true;
  } catch (error) {
    logger.error('Error sending email via Resend', error);
    return false;
  }
}

/**
 * Send email via SendGrid API
 */
async function sendEmailViaSendGrid(options: EmailOptions & { from: string }, apiKey: string): Promise<boolean> {
  const { to, subject, html, from, attachments } = options;

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            subject,
          },
        ],
        from: { email: from },
        content: [
          {
            type: 'text/html',
            value: html,
          },
        ],
        attachments: [
          // Inline logo (CID-referenced in HTML)
          {
            content: NUTRIENT_LOGO_BASE64,
            filename: 'nutrient-logo.png',
            type: 'image/png',
            disposition: 'inline',
            content_id: NUTRIENT_LOGO_CID,
          },
          // File attachments (e.g. signed PDFs)
          ...(attachments?.map((a) => ({
            content: a.content,
            filename: a.filename,
            type: 'application/pdf',
            disposition: 'attachment',
          })) ?? []),
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('SendGrid API error', new Error(errorText));
      return false;
    }

    logger.info('Email sent successfully via SendGrid', { to, subject });
    return true;
  } catch (error) {
    logger.error('Error sending email via SendGrid', error);
    return false;
  }
}

/**
 * Generate email HTML for document cancellation notification
 */
export function generateCancellationEmail(params: {
  recipientName: string;
  senderName: string;
  documentName: string;
  reason?: string;
  dashboardUrl: string;
}): string {
  const recipientName = escapeEmailHtml(params.recipientName);
  const senderName = escapeEmailHtml(params.senderName);
  const documentName = escapeEmailHtml(params.documentName);
  const reason = params.reason ? escapeEmailHtml(params.reason) : undefined;
  const dashboardUrl = escapeEmailHtml(params.dashboardUrl);

  return `${emailHeader()}

          <!-- Main Card -->
          <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e5e5e5; overflow: hidden;">
            <!-- Status Banner -->
            <div style="background: #fef2f2; padding: 16px 24px; border-bottom: 1px solid #fecaca;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #dc2626;">Document Cancelled</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px 24px;">
              <p style="margin: 0 0 16px 0; font-size: 15px;">Hi ${recipientName},</p>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #525252;">
                The following document has been cancelled by <strong style="color: #1a1414;">${senderName}</strong> and no longer requires your signature:
              </p>

              <!-- Document Info -->
              <div style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1414;">${documentName}</p>
              </div>

              ${
                reason
                  ? `
              <div style="background: #fafafa; border-left: 3px solid #a3a3a3; padding: 12px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #525252;"><strong>Reason:</strong> ${reason}</p>
              </div>
              `
                  : ''
              }

              <p style="margin: 0 0 32px 0; font-size: 14px; color: #737373;">
                No further action is required from you regarding this document.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="${dashboardUrl}" style="display: inline-block; background: #1a1414; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px;">
                  View Your Inbox
                </a>
              </div>
            </div>
          </div>

          ${emailFooter()}`;
}

/**
 * Generate email HTML for document signing request
 */
export function generateSigningEmail(params: {
  recipientName: string;
  senderName: string;
  documentName: string;
  signingUrl: string;
  message?: string;
  expiresAt?: Date;
}): string {
  const recipientName = escapeEmailHtml(params.recipientName);
  const senderName = escapeEmailHtml(params.senderName);
  const documentName = escapeEmailHtml(params.documentName);
  const signingUrl = escapeEmailHtml(params.signingUrl);
  const message = params.message ? escapeEmailHtml(params.message) : undefined;
  const { expiresAt } = params;

  return `${emailHeader()}

          <!-- Main Card -->
          <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e5e5e5; overflow: hidden;">
            <!-- Status Banner -->
            <div style="background: #f0fdf4; padding: 16px 24px; border-bottom: 1px solid #bbf7d0;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #15803d;">Signature Requested</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px 24px;">
              <p style="margin: 0 0 16px 0; font-size: 15px;">Hi ${recipientName},</p>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #525252;">
                <strong style="color: #1a1414;">${senderName}</strong> has sent you a document to sign:
              </p>

              <!-- Document Info -->
              <div style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1a1414;">${documentName}</p>
              </div>

              ${
                message
                  ? `
              <div style="background: #fafafa; border-left: 3px solid #a3a3a3; padding: 12px 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #525252;">${message}</p>
              </div>
              `
                  : ''
              }

              ${
                expiresAt
                  ? `
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #737373;">
                <span style="display: inline-block; margin-right: 6px;">&#128337;</span>
                Expires on: <strong style="color: #525252;">${expiresAt.toLocaleDateString()}</strong>
              </p>
              `
                  : ''
              }

              <!-- CTA Button -->
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${signingUrl}" style="display: inline-block; background: #1a1414; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px;">
                  Review & Sign Document
                </a>
              </div>

              <p style="margin: 0; font-size: 13px; color: #a3a3a3; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${signingUrl}" style="color: #525252; word-break: break-all;">${signingUrl}</a>
              </p>
            </div>
          </div>

          ${emailFooter()}`;
}

export function generateDeclinedEmail(params: {
  documentName: string;
  recipientName: string;
  signerName: string;
}): string {
  const documentName = escapeEmailHtml(params.documentName);
  const recipientName = escapeEmailHtml(params.recipientName);
  const signerName = escapeEmailHtml(params.signerName);
  return `${emailHeader()}
          <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e5e5e5; padding: 32px 24px;">
            <p style="margin: 0 0 16px; font-size: 15px;">Hi ${recipientName},</p>
            <p style="margin: 0 0 16px; font-size: 15px; color: #525252;">
              <strong>${signerName}</strong> declined to sign <strong>${documentName}</strong>.
            </p>
            <p style="margin: 0; font-size: 14px; color: #737373;">
              The signing workflow has been stopped and all remaining signing links have been cancelled.
            </p>
          </div>
          ${emailFooter()}`;
}

/**
 * Generate email HTML for document completion notification
 */
export function generateCompletionEmail(params: {
  recipientName: string;
  documentName: string;
  signers: Array<{ name: string; signedAt: Date }>;
  dashboardUrl: string;
}): string {
  const recipientName = escapeEmailHtml(params.recipientName);
  const documentName = escapeEmailHtml(params.documentName);
  const signers = params.signers.map((signer) => ({ ...signer, name: escapeEmailHtml(signer.name) }));
  const dashboardUrl = escapeEmailHtml(params.dashboardUrl);

  const signerRows = signers
    .map(
      (s) =>
        `<tr>
          <td style="padding: 8px 0; font-size: 14px; color: #1a1414;">${s.name}</td>
          <td style="padding: 8px 0; font-size: 14px; color: #737373; text-align: right;">${s.signedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        </tr>`,
    )
    .join('');

  return `${emailHeader()}

          <!-- Main Card -->
          <div style="background: #ffffff; border-radius: 8px; border: 1px solid #e5e5e5; overflow: hidden;">
            <!-- Status Banner -->
            <div style="background: #f0fdf4; padding: 16px 24px; border-bottom: 1px solid #bbf7d0;">
              <p style="margin: 0; font-size: 14px; font-weight: 600; color: #15803d;">Document Completed</p>
            </div>

            <!-- Content -->
            <div style="padding: 32px 24px;">
              <p style="margin: 0 0 16px 0; font-size: 15px;">Hi ${recipientName},</p>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #525252;">
                All parties have signed <strong style="color: #1a1414;">${documentName}</strong>. A signed copy is attached to this email.
              </p>

              <!-- Signer Table -->
              <div style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #737373; text-transform: uppercase; letter-spacing: 0.05em;">Signed by</p>
                <table style="width: 100%; border-collapse: collapse;">
                  ${signerRows}
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="${dashboardUrl}" style="display: inline-block; background: #1a1414; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 6px;">
                  View in Dashboard
                </a>
              </div>
            </div>
          </div>

          ${emailFooter()}`;
}

/**
 * Send completion emails with the signed PDF attached to all participants and the document owner.
 * Called after digital signature is successfully applied.
 */
export async function sendCompletionEmails(signedPdfBuffer: ArrayBuffer, documentId: string): Promise<void> {
  try {
    // Fetch document with owner info
    const documentResults = await db
      .select({ document: documents, owner: users })
      .from(documents)
      .innerJoin(users, eq(documents.ownerId, users.id))
      .where(eq(documents.id, documentId));

    if (documentResults.length === 0) {
      logger.error('sendCompletionEmails: document not found', { documentId });
      return;
    }

    const { document, owner } = documentResults[0];

    // Fetch all participants with their user info
    const participantResults = await db
      .select({ participant: documentParticipants, user: users })
      .from(documentParticipants)
      .innerJoin(users, eq(documentParticipants.userId, users.id))
      .where(eq(documentParticipants.documentId, documentId));

    // Fetch signer details (name + signedAt) for the email template
    const signerResults = await db
      .select({
        signatureRequest: signatureRequests,
        participant: documentParticipants,
        user: users,
      })
      .from(signatureRequests)
      .innerJoin(documentParticipants, eq(signatureRequests.participantId, documentParticipants.id))
      .innerJoin(users, eq(documentParticipants.userId, users.id))
      .where(eq(signatureRequests.documentId, documentId));

    const signers = signerResults
      .filter(
        (r): r is typeof r & { signatureRequest: { signedAt: Date } } =>
          r.signatureRequest.status === 'SIGNED' && r.signatureRequest.signedAt !== null,
      )
      .map((r) => ({
        name: r.user.name || r.user.email || 'Unknown',
        signedAt: r.signatureRequest.signedAt,
      }));

    // Build deduplicated recipient list (owner + all participants) keyed by email
    const recipientMap = new Map<string, { name: string; email: string }>();

    // Always include owner
    if (owner.email) {
      recipientMap.set(owner.email, {
        name: owner.name || owner.email,
        email: owner.email,
      });
    }

    // Add all participants
    for (const { user } of participantResults) {
      if (user.email && !recipientMap.has(user.email)) {
        recipientMap.set(user.email, {
          name: user.name || user.email,
          email: user.email,
        });
      }
    }

    const recipients = Array.from(recipientMap.values());

    if (recipients.length === 0) {
      logger.warn('sendCompletionEmails: no recipients found', { documentId });
      return;
    }

    // Prepare attachment
    const pdfBase64 = Buffer.from(signedPdfBuffer).toString('base64');
    const attachmentFilename = `${document.name} - Signed.pdf`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const dashboardUrl = `${appUrl}/documents/${documentId}`;

    // Send emails independently (per-recipient resilience)
    const emailResults = await Promise.all(
      recipients.map(async (recipient) => {
        try {
          const emailHtml = generateCompletionEmail({
            recipientName: recipient.name,
            documentName: document.name,
            signers,
            dashboardUrl,
          });

          const success = await sendEmail({
            to: recipient.email,
            subject: `Completed: ${document.name}`,
            html: emailHtml,
            attachments: [{ filename: attachmentFilename, content: pdfBase64 }],
          });

          return { email: recipient.email, success };
        } catch (error) {
          logger.error('Failed to send completion email', error, {
            documentId,
            recipient: recipient.email,
          });
          return { email: recipient.email, success: false };
        }
      }),
    );

    // Batch insert notification records
    const notificationValues = emailResults.map((result) => ({
      id: crypto.randomUUID(),
      documentId,
      recipientEmail: result.email,
      notificationType: 'DOCUMENT_COMPLETED' as const,
      sentAt: new Date(),
      isDelivered: result.success,
      deliveredAt: result.success ? new Date() : null,
    }));

    if (notificationValues.length > 0) {
      await db.insert(documentNotifications).values(notificationValues);
    }

    const sent = emailResults.filter((r) => r.success).length;
    logger.info('Completion emails sent', { documentId, sent, total: recipients.length });
  } catch (error) {
    logger.error('sendCompletionEmails failed', error, { documentId });
  }
}
