-- Migration: Add source column to cinemas table for strategy pattern support
-- Issue: #452

ALTER TABLE cinemas ADD COLUMN source VARCHAR(50) DEFAULT 'allocine';
