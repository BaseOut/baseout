// Copies the static extension shell (manifest + panel html) into dist/ after
// tsup emits background.js + sidepanel.js, producing a directory loadable
// unpacked via chrome://extensions.
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
await mkdir(join(root, 'dist'), { recursive: true })
for (const file of ['manifest.json', 'sidepanel.html']) {
  await copyFile(join(root, 'static', file), join(root, 'dist', file))
}
console.log('assembled dist/ — load unpacked via chrome://extensions')
