import { defineConfig } from 'drizzle-kit'

// Drizzle owns the schema lifecycle; the Supabase CLI owns the platform.
// Generate is offline (diffs the composed TS schema vs meta/_snapshot.json);
// apply is done by scripts/db-apply.mjs via the Management API.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  schemaFilter: ['public'],
  verbose: true,
  strict: true,
})
