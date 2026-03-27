-- Grant access to archetype tables created in migration 000004
-- The original GRANT ALL ON ALL TABLES only covered tables that existed at that time
GRANT ALL ON ALL TABLES IN SCHEMA saas_core TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA saas_core TO anon;
