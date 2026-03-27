-- Add missing columns to invitations table
ALTER TABLE saas_core.invitations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS location_ids uuid[] DEFAULT '{}';

-- Add UPDATE and DELETE policies for invite management
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invites_update' AND tablename = 'invitations') THEN
    CREATE POLICY "invites_update" ON saas_core.invitations FOR UPDATE
      USING (saas_core.is_tenant_admin(tenant_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'invites_delete' AND tablename = 'invitations') THEN
    CREATE POLICY "invites_delete" ON saas_core.invitations FOR DELETE
      USING (saas_core.is_tenant_admin(tenant_id));
  END IF;
END $$;
