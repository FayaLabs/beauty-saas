import { spawnSync } from 'node:child_process'

const insideGit = spawnSync('git', ['rev-parse', '--git-dir'], {
  stdio: 'ignore',
  windowsHide: true,
})

if (insideGit.status === 0) {
  const configured = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], {
    stdio: 'inherit',
    windowsHide: true,
  })
  if (configured.error) throw configured.error
  if (configured.status !== 0) process.exitCode = configured.status ?? 1
}
