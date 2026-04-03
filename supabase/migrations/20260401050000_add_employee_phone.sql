-- Migration: Add Phone Column to Employees
-- Keeps WhatsApp trackable securely. RLS on the employees table ensures only authorized team members can select rows in their category/unit.

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS phone TEXT;
