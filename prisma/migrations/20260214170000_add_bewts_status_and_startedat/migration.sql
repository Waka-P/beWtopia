/*
Migration: add status enum and started_at to bewts_projects
- Adds an ENUM column `f_status` with default 'RECRUITING'
- Adds nullable `f_started_at` datetime column
- Safe default preserves existing rows as RECRUITING
 */
ALTER TABLE `bewts_projects`
ADD COLUMN `f_status` ENUM('RECRUITING', 'DEVELOPING', 'COMPLETED') NOT NULL DEFAULT 'RECRUITING',
ADD COLUMN `f_started_at` DATETIME NULL;