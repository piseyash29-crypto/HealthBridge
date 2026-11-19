CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`patient_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`patient_id` text,
	`data` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`doctor_id` text,
	`slot_date` text,
	`slot_time` text,
	`status` text,
	`created_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entity_kind_patient` ON `entities` (`kind`,`patient_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_doctor_slot` ON `entities` (`doctor_id`,`slot_date`,`slot_time`) WHERE "entities"."kind" = 'appointments' AND "entities"."status" = 'Scheduled';--> statement-breakpoint
CREATE UNIQUE INDEX `appointment_patient_slot` ON `entities` (`patient_id`,`slot_date`,`slot_time`) WHERE "entities"."kind" = 'appointments' AND "entities"."status" = 'Scheduled';--> statement-breakpoint
CREATE UNIQUE INDEX `occupied_patient_bed` ON `entities` (`patient_id`) WHERE "entities"."kind" = 'beds' AND "entities"."patient_id" IS NOT NULL;--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'patient' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`patient_id` text,
	`created_at` text NOT NULL
);
