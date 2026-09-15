import {
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './auth-schema'; // Assuming the previous auth schema is in this file

// Enum definitions
export const documentStatus = pgEnum('document_status', [
  'DRAFT',
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'AWAITING_WET_SIGNATURE',
  'DECLINED',
  'CANCELLED',
]);

export const signatureStatus = pgEnum('signature_status', ['PENDING', 'SIGNED', 'DECLINED', 'CANCELLED']);

export const documentAccessLevel = pgEnum('document_access_level', ['VIEWER', 'EDITOR', 'SIGNER', 'CC']);

export const signatureType = pgEnum('signature_type', ['ELECTRONIC', 'DIGITAL']);
export const documentFinalizationMode = pgEnum('document_finalization_mode', ['ELECTRONIC', 'DIGITAL_SEAL']);
export const documentSigningMethod = pgEnum('document_signing_method', ['ELECTRONIC', 'WET']);

// Document Templates Table
export const documentTemplates = pgTable('document_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),

  creatorId: text('creator_id').references(() => users.id, { onDelete: 'cascade' }),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  templateFilePath: text('template_file_path').notNull(),
  templateFileHash: text('template_file_hash'),
  packetManifest: jsonb('packet_manifest'),
  size: integer('size'),
});

// Documents Table
export const documents = pgTable(
  'documents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),

    templateId: text('template_id').references(() => documentTemplates.id),

    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),

    documentFilePath: text('document_file_path').notNull(),
    documentFileHash: text('document_file_hash'),

    // Original ordered document boundaries when this row represents a packet.
    packetManifest: jsonb('packet_manifest'),

    // Shared idempotency/tracking key for copies created by one repapering run.
    repaperingBatchId: text('repapering_batch_id'),
    repaperingIndex: integer('repapering_index'),

    // Whether completion is electronic-only or receives a cryptographic DWS seal.
    finalizationMode: documentFinalizationMode('finalization_mode').default('DIGITAL_SEAL').notNull(),
    signingMethod: documentSigningMethod('signing_method').default('ELECTRONIC').notNull(),
    wetSignedReturnedAt: timestamp('wet_signed_returned_at', { mode: 'date' }),

    size: integer('size'),

    // Document expiration timestamp
    expiresAt: timestamp('expires_at', { mode: 'date' }),

    // Document status tracking
    status: documentStatus('status').default('DRAFT'),

    // Signing order - when false, all signers can sign in any order
    requireSequentialSigning: boolean('require_sequential_signing').default(false),

    // Soft delete timestamp
    deletedAt: timestamp('deleted_at', { mode: 'date' }),

    // Path to the DWS digitally-signed PDF in S3 (set when status = COMPLETED)
    signedDocumentFilePath: text('signed_document_file_path'),
  },
  (table) => ({
    ownerIdIdx: index('documents_owner_id_idx').on(table.ownerId),
    statusIdx: index('documents_status_idx').on(table.status),
    repaperingBatchIdx: index('documents_repapering_batch_id_idx').on(table.repaperingBatchId),
    repaperingBatchItemIdx: uniqueIndex('documents_repapering_batch_item_idx').on(
      table.repaperingBatchId,
      table.repaperingIndex,
    ),
  }),
);

// Document Participants Table
export const documentParticipants = pgTable(
  'document_participants',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    accessLevel: documentAccessLevel('access_level').notNull(),
    signingOrder: integer('signing_order').default(0),

    isRequired: boolean('is_required').default(true).notNull(),
  },
  (table) => ({
    uniqDocUser: unique().on(table.documentId, table.userId),
    documentIdIdx: index('document_participants_document_id_idx').on(table.documentId),
  }),
);

// Signature Requests Table
export const signatureRequests = pgTable(
  'signature_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    participantId: text('participant_id')
      .notNull()
      .references(() => documentParticipants.id, { onDelete: 'cascade' }),

    signatureType: signatureType('signature_type').notNull().default('ELECTRONIC'),
    status: signatureStatus('status').default('PENDING'),

    requestedAt: timestamp('requested_at', { mode: 'date' }).defaultNow(),
    signedAt: timestamp('signed_at', { mode: 'date' }),

    // Secure access token for signing (used in email links)
    accessToken: text('access_token').unique(),

    digitalSignatureHash: text('digital_signature_hash'),
    signatureCertificatePath: text('signature_certificate_path'),
  },
  (table) => ({
    uniqDocumentParticipant: unique('signature_requests_document_participant_unique').on(
      table.documentId,
      table.participantId,
    ),
    documentIdIdx: index('signature_requests_document_id_idx').on(table.documentId),
    participantIdIdx: index('signature_requests_participant_id_idx').on(table.participantId),
  }),
);

// Document Annotations Table
export const documentAnnotations = pgTable(
  'document_annotations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    annotationData: jsonb('annotation_data').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),

    isFinalized: boolean('is_finalized').default(false),
  },
  (table) => ({
    documentIdIdx: index('document_annotations_document_id_idx').on(table.documentId),
  }),
);

// Audit Log Table
export const documentAuditLog = pgTable(
  'document_audit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id),

    action: text('action').notNull(),
    details: jsonb('details'),

    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
  },
  (table) => ({
    documentIdIdx: index('document_audit_log_document_id_idx').on(table.documentId),
    userIdIdx: index('document_audit_log_user_id_idx').on(table.userId),
  }),
);

// Notification Tracking Table
export const documentNotifications = pgTable(
  'document_notifications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    recipientEmail: text('recipient_email').notNull(),

    notificationType: text('notification_type'),
    sentAt: timestamp('sent_at', { mode: 'date' }).defaultNow(),

    isDelivered: boolean('is_delivered').default(false),
    deliveredAt: timestamp('delivered_at', { mode: 'date' }),
  },
  (table) => ({
    documentIdIdx: index('document_notifications_document_id_idx').on(table.documentId),
  }),
);
