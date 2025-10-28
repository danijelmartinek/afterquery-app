-- Coding Interview Platform Database Schema
-- Generated based on architecture plan for MVP implementation.

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenancy
CREATE TABLE IF NOT EXISTS orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','admin','viewer')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

-- Seeds
CREATE TABLE IF NOT EXISTS seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  source_repo_url text NOT NULL,
  seed_repo_full_name text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  is_template boolean NOT NULL DEFAULT true,
  latest_main_sha text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seeds_org_id ON seeds(org_id);

-- Assessments
CREATE TABLE IF NOT EXISTS assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  seed_id uuid REFERENCES seeds(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  instructions text,
  candidate_email_subject text,
  candidate_email_body text,
  time_to_start interval NOT NULL,
  time_to_complete interval NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_assessments_org_id ON assessments(org_id);

-- Invitations
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES assessments(id) ON DELETE CASCADE,
  candidate_email text NOT NULL,
  candidate_name text,
  status text CHECK (status IN ('sent','accepted','started','submitted','expired','revoked')) DEFAULT 'sent',
  start_deadline timestamptz,
  complete_deadline timestamptz,
  start_link_token_hash text UNIQUE NOT NULL,
  sent_at timestamptz DEFAULT now(),
  started_at timestamptz,
  submitted_at timestamptz,
  expired_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_invitations_assessment_id ON invitations(assessment_id);

-- Candidate repositories
CREATE TABLE IF NOT EXISTS candidate_repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE,
  seed_sha_pinned text NOT NULL,
  repo_full_name text NOT NULL,
  repo_html_url text,
  github_repo_id bigint,
  active boolean DEFAULT true,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidate_repos_repo_full_name ON candidate_repos(repo_full_name);

-- Opaque access tokens (stored hashed)
CREATE TABLE IF NOT EXISTS access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE,
  repo_full_name text NOT NULL,
  opaque_token_hash text UNIQUE NOT NULL,
  scope text CHECK (scope IN ('clone','push','clone+push')) DEFAULT 'clone+push',
  expires_at timestamptz NOT NULL,
  revoked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_access_tokens_invitation_id ON access_tokens(invitation_id);

-- Submissions
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE,
  final_sha text NOT NULL,
  repo_html_url text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_submissions_invitation_id ON submissions(invitation_id);

-- Review comments
CREATE TABLE IF NOT EXISTS review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE,
  path text,
  line integer,
  body text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_comments_invitation_id ON review_comments(invitation_id);

-- Review feedback
CREATE TABLE IF NOT EXISTS review_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE,
  summary text,
  rating int CHECK (rating BETWEEN 1 AND 5),
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_feedback_invitation_id ON review_feedback(invitation_id);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES orgs(id) ON DELETE CASCADE,
  key text,
  subject text,
  body text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, key)
);

-- Email events
CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE,
  type text CHECK (type IN ('invite','reminder','follow_up')),
  provider_id text,
  to_email text,
  status text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_events_invitation_id ON email_events(invitation_id);

-- Audit events
CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  kind text,
  actor text,
  meta jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_events_kind ON audit_events(kind);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);

