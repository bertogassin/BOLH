import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const standaloneDir = join(projectDir, '.next', 'standalone')
const serverFile = join(standaloneDir, 'server.js')

if (!existsSync(serverFile)) {
  console.error('Standalone build not found. Run npm run build:termux first.')
  process.exit(1)
}

const staticTarget = join(standaloneDir, '.next', 'static')
mkdirSync(join(standaloneDir, '.next'), { recursive: true })
cpSync(join(projectDir, '.next', 'static'), staticTarget, { recursive: true, force: true })
if (existsSync(join(projectDir, 'public'))) {
  cpSync(join(projectDir, 'public'), join(standaloneDir, 'public'), { recursive: true, force: true })
}

const child = spawn(process.execPath, [serverFile], {
  cwd: standaloneDir,
  env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: process.env.PORT || '3003' },
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
child.on('exit', (code) => process.exit(code ?? 0))
