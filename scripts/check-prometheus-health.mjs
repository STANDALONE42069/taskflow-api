const endpoint = process.env.LAB9_PROMETHEUS_URL;
const jobName = process.env.PROMETHEUS_JOB_LABEL || process.env.JOB_NAME;
const minimumBuilds = 20;
const minimumSuccessRate = 0.9;

if (!endpoint || !jobName) {
  throw new Error('LAB9_PROMETHEUS_URL and PROMETHEUS_JOB_LABEL (or JOB_NAME) are required.');
}

function quotePrometheusLabel(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

const selector = `{jenkins_job="${quotePrometheusLabel(jobName)}"}`;
const starts = `default_jenkins_builds_build_start_time_milliseconds${selector}`;
const results = `default_jenkins_builds_build_result_ordinal${selector}`;
const latestCompleted = `topk by (jenkins_job) (20, ${starts} and on (jenkins_job, number) ${results})`;
const countQuery = `count by (jenkins_job) (${latestCompleted})`;
const successQuery = `sum by (jenkins_job) ((${results} == bool 0) and on (jenkins_job, number) ${latestCompleted}) / ${countQuery}`;

async function queryPrometheus(query) {
  const url = new URL('/api/v1/query', endpoint);
  url.searchParams.set('query', query);
  const headers = {};
  if (process.env.PROMETHEUS_BEARER_TOKEN) {
    headers.Authorization = `Bearer ${process.env.PROMETHEUS_BEARER_TOKEN}`;
  }

  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    throw new Error(`Prometheus returned HTTP ${response.status} for the build-health query.`);
  }

  const body = await response.json();
  if (body.status !== 'success') {
    throw new Error(`Prometheus query failed: ${body.error || 'unknown query error'}`);
  }
  return body.data?.result ?? [];
}

const [countResult, successResult] = await Promise.all([
  queryPrometheus(countQuery),
  queryPrometheus(successQuery),
]);

const buildCount = Number(countResult[0]?.value?.[1]);
const successRate = Number(successResult[0]?.value?.[1]);
if (!Number.isFinite(buildCount) || buildCount < minimumBuilds || !Number.isFinite(successRate)) {
  throw new Error(`Pipeline health gate is closed: Prometheus has fewer than ${minimumBuilds} completed builds for ${jobName}.`);
}

console.log(`PIPELINE_HEALTH job=${jobName} builds=${buildCount} success_rate=${(successRate * 100).toFixed(1)}% threshold=90%`);
if (successRate < minimumSuccessRate) {
  throw new Error(`Pipeline health gate blocked production: ${(successRate * 100).toFixed(1)}% is below 90%.`);
}
