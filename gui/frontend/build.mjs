import esbuild from 'esbuild';
import { solidPlugin } from 'esbuild-plugin-solid';

const watch = process.argv.includes('--watch');
const dev = watch || process.argv.includes('--dev');   // readable bundle for debugging
const ctx = await esbuild.context({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
  // delegateEvents: false is REQUIRED on Silver: Solid's delegated handler redefines
  // Event.currentTarget as a getter-only property, which Silver's own event dispatch
  // then fails to assign ("no setter for property"). Plain addEventListener works.
  plugins: [solidPlugin({ solid: { delegateEvents: false } })],
  minify: !dev,
  sourcemap: false,
  outfile: 'dist/app.js',
  logLevel: 'info',
});
if (watch) { await ctx.watch(); console.log('watching…'); }
else { await ctx.rebuild(); await ctx.dispose(); }
