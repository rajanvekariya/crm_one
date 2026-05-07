CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    price_yearly INT NOT NULL,
    price_monthly INT NOT NULL,
    max_users INT NOT NULL,
    billing_cycle VARCHAR(20) DEFAULT 'yearly' CHECK (billing_cycle IN ('yearly', 'monthly'))
);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  billing_cycle VARCHAR(20) DEFAULT 'yearly' CHECK (billing_cycle IN ('yearly', 'monthly')),
  plan_start_date TIMESTAMP,
  plan_end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    country VARCHAR(100) NOT NULL,
    timezone VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id VARCHAR(255) NOT NULL,
  company_id UUID REFERENCES companies(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  followup_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  is_notification_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE followups
  ADD COLUMN IF NOT EXISTS whatsapp_images TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE followups
  ADD COLUMN IF NOT EXISTS closure_reason VARCHAR(255) DEFAULT '';

ALTER TABLE followups
  ADD COLUMN IF NOT EXISTS closure_notes TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_followups_company_followup_at
  ON followups(company_id, followup_at);

CREATE INDEX IF NOT EXISTS idx_followups_assigned_unread
  ON followups(assigned_to, is_notification_read, followup_at);
