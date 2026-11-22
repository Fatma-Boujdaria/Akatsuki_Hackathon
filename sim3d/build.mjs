// Builds dist/cartheco-3d.html: one offline page (Three.js and the sim inlined).
//   cd sim3d && npm install && node build.mjs
import {build} from 'esbuild';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = await build({
  entryPoints: [join(here, 'src/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  target: 'es2020',
  alias: {'teardown-kit': join(here, 'kit')},
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const head = readFileSync(join(here, 'shell-head.html'), 'utf8');
const tail = readFileSync(join(here, 'shell-tail.txt'), 'utf8');
writeFileSync(join(here, 'dist/cartheco-3d.html'), head + js + tail);
console.log('dist/cartheco-3d.html', Math.round((head.length + js.length) / 1024), 'KB');
