import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const members=sqliteTable('members',{id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),role:text('role').notNull().default('patient'),status:text('status').notNull().default('active'),patientId:text('patient_id'),createdAt:text('created_at').notNull()});
export const entities=sqliteTable('entities',{id:text('id').primaryKey(),kind:text('kind').notNull(),patientId:text('patient_id'),data:text('data').notNull(),version:integer('version').notNull().default(1),doctorId:text('doctor_id'),slotDate:text('slot_date'),slotTime:text('slot_time'),status:text('status'),createdBy:text('created_by').notNull(),updatedAt:text('updated_at').notNull()},t=>[
index('entity_kind_patient').on(t.kind,t.patientId),
uniqueIndex('appointment_doctor_slot').on(t.doctorId,t.slotDate,t.slotTime).where(sql`${t.kind} = 'appointments' AND ${t.status} = 'Scheduled'`),
uniqueIndex('appointment_patient_slot').on(t.patientId,t.slotDate,t.slotTime).where(sql`${t.kind} = 'appointments' AND ${t.status} = 'Scheduled'`),
uniqueIndex('occupied_patient_bed').on(t.patientId).where(sql`${t.kind} = 'beds' AND ${t.patientId} IS NOT NULL`)
]);
export const audit=sqliteTable('audit',{id:text('id').primaryKey(),actor:text('actor').notNull(),action:text('action').notNull(),entityId:text('entity_id').notNull(),patientId:text('patient_id'),createdAt:text('created_at').notNull()});
export const limits=sqliteTable('rate_limits',{id:text('id').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});
