import { spawnSync } from 'node:child_process';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write(
    'DATABASE_URL is not set. Required for drizzle-kit migrate.\n',
  );
  process.exit(1);
}

const result = spawnSync('npx', ['drizzle-kit', 'migrate'], {
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
