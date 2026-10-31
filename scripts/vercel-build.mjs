import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function buildPlan(environment) {
  return [
    ['npm', ['run', 'test:agent-quality']],
    ...(environment === 'production'
      ? [
          ['npm', ['run', 'db:migrate']],
          ['npx', ['playwright', 'test', '--config', 'playwright.admin-db.config.ts']],
        ]
      : []),
    ['npm', ['run', 'build']],
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(
    process.env.VERCEL_ENV === 'production'
      ? 'Production build: retaining release and database checks.'
      : 'Preview build: skipping database migrations and owner-database queries.',
  );
  for (const [command, args] of buildPlan(process.env.VERCEL_ENV)) {
    const result = spawnSync(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
