CREATE INDEX "document_annotations_document_id_idx" ON "document_annotations" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_audit_log_document_id_idx" ON "document_audit_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_audit_log_user_id_idx" ON "document_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_notifications_document_id_idx" ON "document_notifications" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_participants_document_id_idx" ON "document_participants" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_owner_id_idx" ON "documents" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signature_requests_document_id_idx" ON "signature_requests" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signature_requests_participant_id_idx" ON "signature_requests" USING btree ("participant_id");