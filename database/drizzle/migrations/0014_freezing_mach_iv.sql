ALTER TABLE "documents" ADD COLUMN "repapering_batch_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "repapering_index" integer;--> statement-breakpoint
CREATE INDEX "documents_repapering_batch_id_idx" ON "documents" USING btree ("repapering_batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_repapering_batch_item_idx" ON "documents" USING btree ("repapering_batch_id","repapering_index");