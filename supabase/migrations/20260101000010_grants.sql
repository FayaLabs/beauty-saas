-- Ensure all roles have access to both schemas
GRANT USAGE ON SCHEMA saas_core TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA saas_core TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA saas_core TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA saas_core TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
