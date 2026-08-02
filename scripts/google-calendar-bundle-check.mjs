import { build } from 'esbuild'

const entries = [
  'supabase/functions/google-calendar-sync/index.ts',
  'supabase/functions/google-calendar-webhook/index.ts',
]

const denoRemoteImports = {
  name: 'deno-remote-imports',
  setup(context) {
    context.onResolve({ filter: /^https:\/\//u }, (args) => ({
      path: args.path,
      external: true,
    }))
  },
}

let failed = false
for (const entry of entries) {
  try {
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'neutral',
      target: 'es2022',
      write: false,
      logLevel: 'silent',
      plugins: [denoRemoteImports],
    })
    const bytes = result.outputFiles.reduce((total, file) => total + file.contents.length, 0)
    console.log(`PASS ${entry} (${bytes} bundled bytes)`)
  } catch (error) {
    failed = true
    console.error(`FAIL ${entry}`)
    console.error(String(error?.message ?? error))
  }
}

if (failed) process.exitCode = 1
