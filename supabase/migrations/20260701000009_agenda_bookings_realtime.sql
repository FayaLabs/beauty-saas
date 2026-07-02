-- Refresh open Agenda clients when an inbound integration changes bookings.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'saas_core'
       AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE saas_core.bookings;
  END IF;
END;
$$;
