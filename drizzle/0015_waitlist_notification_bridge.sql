DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'saas_core'
      AND tablename = 'notifications'
      AND policyname = 'notif_insert_own'
  ) THEN
    CREATE POLICY "notif_insert_own" ON saas_core.notifications
      FOR INSERT TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
