import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const scanDirs = ['app', 'components'].map((d) => path.join(root, d))
const localeFiles = ['en', 'fr', 'de', 'ru'].map((l) => ({
  code: l,
  file: path.join(root, 'public', 'locales', `${l}.json`),
}))
const exts = new Set(['.ts', '.tsx'])
const skipDirs = new Set(['node_modules', '.next'])

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue
      walk(full, out)
      continue
    }
    if (exts.has(path.extname(entry.name))) out.push(full)
  }
  return out
}

function flatten(obj, prefix = '', out = {}) {
  if (!obj || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else out[key] = v
  }
  return out
}

const keyRegex = /\bt\(\s*['"`]([^'"`]+)['"`]\s*\)/g
const usedKeys = new Set()
const files = scanDirs.flatMap((d) => walk(d))
for (const file of files) {
  const txt = fs.readFileSync(file, 'utf8')
  for (const m of txt.matchAll(keyRegex)) {
    const key = m[1]
    // Skip dynamic template keys like status.${status}
    if (key.includes('${')) continue
    usedKeys.add(key)
  }
}

let hasMissing = false
for (const { code, file } of localeFiles) {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'))
  const flat = flatten(json)
  const missing = [...usedKeys].filter((k) => !(k in flat)).sort()
  console.log(`\n[${code}] total keys used: ${usedKeys.size}, missing: ${missing.length}`)
  if (missing.length > 0) {
    hasMissing = true
    for (const key of missing) console.log(`  - ${key}`)
  }
}

process.exit(hasMissing ? 1 : 0)
