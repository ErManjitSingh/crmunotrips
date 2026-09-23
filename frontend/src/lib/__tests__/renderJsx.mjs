/**
 * Test-only: server-render a small JSX entry to an HTML string, bundling the real components with
 * esbuild (already a Vite dependency). Not used by the app.
 */
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

/** `entry` is JSX source that must `export default` a function returning the HTML string. */
export async function renderToHtml(entry) {
  const result = await build({
    stdin: { contents: entry, resolveDir: SRC_DIR, loader: 'jsx', sourcefile: 'entry.jsx' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    write: false,
    logLevel: 'silent',
    banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, // Vite-only global; components that reach the API layer need it to load
  });
  const dir = await mkdtemp(join(tmpdir(), 'jsx-render-'));
  const file = join(dir, 'bundle.mjs');
  try {
    await writeFile(file, result.outputFiles[0].text);
    const mod = await import(pathToFileURL(file).href);
    return mod.default();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
