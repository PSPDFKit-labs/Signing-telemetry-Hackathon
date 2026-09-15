CREATE TYPE "public"."document_access_level" AS ENUM('VIEWER', 'EDITOR', 'SIGNER');
CREATE TYPE "public"."document_status" AS ENUM('DRAFT', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'DECLINED');
CREATE TYPE "public"."signature_status" AS ENUM('PENDING', 'SIGNED', 'DECLINED');
CREATE TYPE "public"."signature_type" AS ENUM('ELECTRONIC', 'DIGITAL');
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);

CREATE TABLE "authenticator" (
	"credentialID" text NOT NULL,
	"userId" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"credentialPublicKey" text NOT NULL,
	"counter" integer NOT NULL,
	"credentialDeviceType" text NOT NULL,
	"credentialBackedUp" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticator_credentialID_unique" UNIQUE("credentialID")
);

CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);

CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);

CREATE TABLE "document_annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"annotation_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"is_finalized" boolean DEFAULT false
);

CREATE TABLE "document_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now(),
	"ip_address" "inet",
	"user_agent" text
);

CREATE TABLE "document_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"recipient_email" text NOT NULL,
	"notification_type" text,
	"sent_at" timestamp DEFAULT now(),
	"is_delivered" boolean DEFAULT false,
	"delivered_at" timestamp
);

CREATE TABLE "document_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_level" "document_access_level" NOT NULL,
	"signing_order" integer DEFAULT 0,
	"is_required" boolean DEFAULT true,
	CONSTRAINT "document_participants_document_id_user_id_unique" UNIQUE("document_id","user_id")
);

CREATE TABLE "document_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"creator_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"template_file_path" text NOT NULL,
	"template_file_hash" text,
	"size" integer
);

CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"template_id" text,
	"owner_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"document_file_path" text NOT NULL,
	"document_file_hash" text,
	"size" integer,
	"esign_compliant" boolean DEFAULT true,
	"expires_at" timestamp
);

CREATE TABLE "signature_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"signature_type" "signature_type" DEFAULT 'ELECTRONIC' NOT NULL,
	"status" "signature_status" DEFAULT 'PENDING',
	"requested_at" timestamp DEFAULT now(),
	"signed_at" timestamp,
	"digital_signature_hash" text,
	"signature_certificate_path" text
);

ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "authenticator" ADD CONSTRAINT "authenticator_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "document_annotations" ADD CONSTRAINT "document_annotations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "document_annotations" ADD CONSTRAINT "document_annotations_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "document_audit_log" ADD CONSTRAINT "document_audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_notifications" ADD CONSTRAINT "document_notifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "document_participants" ADD CONSTRAINT "document_participants_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "document_participants" ADD CONSTRAINT "document_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "documents" ADD CONSTRAINT "documents_template_id_document_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."document_templates"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_participant_id_document_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."document_participants"("id") ON DELETE cascade ON UPDATE no action;
