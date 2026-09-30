const fs = require('node:fs');

const reportPath = process.argv[2];

if (!reportPath) {
  console.error('Usage: node scripts/check-audit.js <npm-audit-report.json>');
  process.exit(2);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (error) {
  console.error(`npm audit did not produce valid JSON: ${error.message}`);
  process.exit(2);
}

const counts = report?.metadata?.vulnerabilities;
if (!counts || !['low', 'moderate', 'high', 'critical', 'total'].every((key) => Number.isInteger(counts[key]) && counts[key] >= 0)) {
  console.error('npm audit JSON is missing severity totals; failing closed.');
  process.exit(2);
}

console.log(
  `npm audit totals: critical=${counts.critical}, high=${counts.high}, moderate=${counts.moderate}, low=${counts.low}, total=${counts.total}`,
);

if (counts.critical > 0) {
  console.log('Critical findings found; the following OPA policy stage will block the pipeline.');
} else if (counts.total > 0) {
  console.warn('Non-critical findings are reported as warnings and do not fail this gate.');
} else {
  console.log('No dependency vulnerabilities found.');
}
