// Prende la Caja (repo granizados-caja) en modo DEMO para sacar capturas, sin tocar los datos reales:
// usa una base H2 aparte (CAJA_DEMO_DB) en vez del PostgreSQL local. App en :5180, API en :8080. PIN 1234.
//   node .claude/caja-demo.mjs        (o preview_start "caja-demo")
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const RAIZ = process.env.CAJA_REPO || 'C:\\Users\\Lenovo\\Downloads\\granizados-caja'
const DB = (process.env.CAJA_DEMO_DB || join(tmpdir(), 'caja-demo', 'demo')).replace(/\\/g, '/')
const win = process.platform === 'win32'

const procesos = [
  {
    cwd: join(RAIZ, 'backend'),
    cmd: (win ? '.\\mvnw.cmd' : './mvnw') + ' -q spring-boot:run',
    env: {
      PORT: '8080',
      SPRING_DATASOURCE_URL: `jdbc:h2:file:${DB};MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH`,
      SPRING_DATASOURCE_USERNAME: 'sa',
      SPRING_DATASOURCE_PASSWORD: '',
      APP_TAREAS_HABILITADAS: 'false',
      // La app demo corre en :5180; sin esto la API rechaza sus peticiones por CORS (403).
      APP_WEBAUTHN_ORIGENES: 'http://localhost:5180,http://localhost:8080',
    },
  },
  { cwd: join(RAIZ, 'frontend'), cmd: 'npm run dev', env: { PORT: '5180' } },
].map((p) => {
  const hijo = spawn(p.cmd, { cwd: p.cwd, shell: true, stdio: 'inherit', env: { ...process.env, ...p.env } })
  hijo.on('exit', apagar)
  return hijo
})

function apagar() {
  for (const p of procesos) {
    if (p.exitCode !== null) continue
    if (win) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' })
    else p.kill('SIGTERM')
  }
  process.exit(0)
}
process.on('SIGINT', apagar)
process.on('SIGTERM', apagar)
