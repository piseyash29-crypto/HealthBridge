-- Additive migration: original records and indexes are retained.
CREATE UNIQUE INDEX IF NOT EXISTS unique_patient_identity ON entities(patient_id) WHERE kind='abha';
CREATE INDEX IF NOT EXISTS care_status ON entities(kind,status,patient_id);
CREATE INDEX IF NOT EXISTS patient_activity ON audit(patient_id,created_at);
