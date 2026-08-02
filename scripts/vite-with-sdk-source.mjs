const [sdkSource, command] = process.argv.slice(2)

if (!['local', 'published'].includes(sdkSource)) {
  throw new Error('Expected SDK source to be "local" or "published"')
}
if (!['build', 'dev'].includes(command)) {
  throw new Error('Expected Vite command to be "build" or "dev"')
}

process.env.FAYZ_SDK_SOURCE = sdkSource
const vite = await import('vite')

if (command === 'build') {
  await vite.build()
} else {
  const server = await vite.createServer()
  await server.listen()
  server.printUrls()
}
