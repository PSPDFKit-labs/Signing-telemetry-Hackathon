import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor !== 22) {
  console.error(
    `Local evaluation requires Node 22; found Node ${process.versions.node}.\n` +
      'Run: nvm install 22 && nvm use 22 && npm install',
  );
  process.exit(1);
}

if (!existsSync('node_modules')) {
  console.error(
    'Dependencies are not installed.\n' +
      'Run: npm install',
  );
  process.exit(1);
}

// Native dependencies are architecture-specific. This catches a dependency
// folder installed through Rosetta/x64 and then reused by native arm64 Node
// (or the reverse) before Docker setup and Next's much longer build error.
try {
  const rootRequire = createRequire(import.meta.url);
  // pnpm nests Oxide under @tailwindcss/postcss instead of exposing it from
  // the application root, so resolve it from its actual parent package.
  const oxideRequire = createRequire(rootRequire.resolve('@tailwindcss/postcss'));
  oxideRequire('@tailwindcss/oxide');
} catch {
  console.error(
    'Dependencies do not match this Node architecture.\n' +
      'After `nvm use 22`, run: rm -rf node_modules && npm install',
  );
  process.exit(1);
}

console.log(`Runtime check passed: Node ${process.versions.node}, native dependencies available.`);
