const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const scanRoots = [
  path.join(projectRoot, 'src'),
  path.join(projectRoot, 'scripts'),
  path.join(projectRoot, 'test'),
];

const excludedDirs = new Set(['node_modules', '.git', 'uploads', 'build', 'dist']);

const rules = [
  {
    id: 'EVAL_USAGE',
    severity: 'high',
    regex: /\beval\s*\(/,
    message: 'Uso de eval detectado',
  },
  {
    id: 'NEW_FUNCTION_USAGE',
    severity: 'high',
    regex: /\bnew\s+Function\s*\(/,
    message: 'Uso de new Function detectado',
  },
  {
    id: 'RAW_SQL_USAGE',
    severity: 'high',
    regex: /sequelize\.query\s*\(/,
    message: 'Consulta SQL cruda detectada (revisar inyeccion)',
  },
  {
    id: 'HARDCODED_API_KEY',
    severity: 'critical',
    regex: /(gsk_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})/,
    message: 'Posible API key hardcodeada detectada',
  },
  {
    id: 'HARDCODED_PASSWORD_ASSIGN',
    severity: 'high',
    regex: /(?:DB_PASSWORD|GMAIL_PASS|JWT_SECRET)\s*=\s*['\"][^'\"]+['\"]/,
    message: 'Posible secreto hardcodeado en codigo',
  },
];

const findings = [];

const walk = (targetPath) => {
  if (!fs.existsSync(targetPath)) return;

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    const base = path.basename(targetPath);
    if (excludedDirs.has(base)) return;

    for (const entry of fs.readdirSync(targetPath)) {
      walk(path.join(targetPath, entry));
    }
    return;
  }

  if (!/\.(js|ts|tsx|json|md)$/.test(targetPath)) {
    return;
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const rule of rules) {
      if (rule.regex.test(line)) {
        findings.push({
          file: path.relative(projectRoot, targetPath),
          line: i + 1,
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message,
          snippet: line.trim(),
        });
      }
    }
  }
};

scanRoots.forEach(walk);

const report = {
  generatedAt: new Date().toISOString(),
  findingsCount: findings.length,
  highOrCriticalCount: findings.filter((f) => f.severity === 'high' || f.severity === 'critical').length,
  findings,
};

const reportDir = path.join(projectRoot, 'security-reports');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const reportPath = path.join(reportDir, 'sast-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`SAST report generated: ${reportPath}`);
console.log(`Findings: ${report.findingsCount}`);

if (report.highOrCriticalCount > 0) {
  console.error(`High/Critical findings: ${report.highOrCriticalCount}`);
  process.exit(1);
}

console.log('No high/critical SAST findings detected.');
