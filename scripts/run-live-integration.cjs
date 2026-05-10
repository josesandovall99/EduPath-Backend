process.env.RUN_LIVE_INTEGRATION = '1';
const { spawnSync } = require('child_process');
const r = spawnSync(
  process.execPath,
  ['./node_modules/jest/bin/jest.js', '--runInBand', 'test/integration/live.localhost.integration.test.js'],
  { stdio: 'inherit', cwd: require('path').join(__dirname, '..') },
);
process.exit(r.status ?? 1);
