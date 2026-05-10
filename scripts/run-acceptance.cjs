process.env.RUN_ACCEPTANCE_INTEGRATION = '1';
process.env.RUN_INTEGRATION_DB_TESTS = '1';
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const suites = [
  'test/integration/login.integration.test.js',
  'test/integration/ejercicio.persist.integration.test.js',
  'test/integration/compilador.integration.test.js',
];

const r = spawnSync(process.execPath, ['./node_modules/jest/bin/jest.js', '--runInBand', ...suites], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(r.status ?? 1);
