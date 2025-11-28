-- Cap Table Timeline - Initial Schema
-- Supports multi-user sharing with equal rights

-- =============================================================================
-- COMPANIES TABLE
-- =============================================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  jurisdiction TEXT,
  incorporation_date DATE,
  authorized_shares BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- COMPANY MEMBERS TABLE (for sharing)
-- =============================================================================
CREATE TABLE company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_company_members_user ON company_members(user_id);
CREATE INDEX idx_company_members_company ON company_members(company_id);

-- =============================================================================
-- EVENTS TABLE
-- =============================================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date DATE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_events_company ON events(company_id);
CREATE INDEX idx_events_company_date ON events(company_id, date);

-- =============================================================================
-- PENDING INVITES TABLE (for future sharing feature)
-- =============================================================================
CREATE TABLE pending_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(company_id, email)
);

ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pending_invites_email ON pending_invites(email);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- =============================================================================
-- RLS POLICIES - Using permissive policies without TO clause (defaults to PUBLIC)
-- Auth checks done via auth.uid() in USING/WITH CHECK clauses
-- =============================================================================

-- COMPANY_MEMBERS: Users can see their own memberships (for company list)
CREATE POLICY "members_view_own" ON company_members
  FOR SELECT USING (user_id = auth.uid());

-- Users can only add themselves as members
CREATE POLICY "members_insert_own" ON company_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can only delete their own membership (leave company)
CREATE POLICY "members_delete_own" ON company_members
  FOR DELETE USING (user_id = auth.uid());

-- COMPANIES: Members can view/update/delete, authenticated users can create
CREATE POLICY "companies_select" ON companies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "companies_insert" ON companies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "companies_update" ON companies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "companies_delete" ON companies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = companies.id
        AND company_members.user_id = auth.uid()
    )
  );

-- EVENTS: Only members of the company can access
CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = events.company_id
        AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = events.company_id
        AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "events_update" ON events
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = events.company_id
        AND company_members.user_id = auth.uid()
    )
  );

CREATE POLICY "events_delete" ON events
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = events.company_id
        AND company_members.user_id = auth.uid()
    )
  );

-- PENDING_INVITES: Members can manage invites, invited users can see/delete their own
CREATE POLICY "invites_select_members" ON pending_invites
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = pending_invites.company_id
        AND company_members.user_id = auth.uid()
    )
  );

-- Invited users can see invites sent to them (use auth.email() function)
CREATE POLICY "invites_select_invited" ON pending_invites
  FOR SELECT USING (
    email = auth.email()
  );

CREATE POLICY "invites_insert" ON pending_invites
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = pending_invites.company_id
        AND company_members.user_id = auth.uid()
    )
  );

-- Members can delete invites
CREATE POLICY "invites_delete_members" ON pending_invites
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = pending_invites.company_id
        AND company_members.user_id = auth.uid()
    )
  );

-- Invited users can delete their own invites (when accepting)
CREATE POLICY "invites_delete_invited" ON pending_invites
  FOR DELETE USING (
    email = auth.email()
  );

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- GRANTS - Ensure roles have proper table permissions
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
