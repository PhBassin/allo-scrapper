-- Migration: Drop redundant superadmins table as auth is now unified in users table
-- Ref: #821

DROP TABLE IF EXISTS public.superadmins;
