import com.codahale.metrics.Gauge
import jenkins.metrics.api.Metrics
import jenkins.model.Jenkins
import org.jenkinsci.plugins.prometheus.config.PrometheusConfiguration

// Copy to JENKINS_HOME/init.groovy.d and restart Jenkins. The queue gauge
// measures the oldest live queue item; completed-build wait metrics cannot
// detect a backlog while the jobs are still waiting.
def prometheus = PrometheusConfiguration.get()
prometheus.setCollectingMetricsPeriodInSeconds(15L)
prometheus.setPerBuildMetrics(true)
prometheus.setPerBuildMetricsMaxAgeInHours(168L)
prometheus.setJobAttributeName('jenkins_job')
prometheus.setCollectDiskUsage(false)
prometheus.save()

def registry = Metrics.metricRegistry()
def metricName = 'taskflow.lab9.oldest.queue.wait.seconds'
if (!registry.metrics.containsKey(metricName)) {
    registry.register(metricName, new Gauge<Double>() {
        @Override
        Double getValue() {
            def queued = Jenkins.get().queue.items
            if (!queued) {
                return 0d
            }
            long oldest = queued.collect { it.inQueueSince as long }.min() as long
            return Math.max(0d, (System.currentTimeMillis() - oldest) / 1000d)
        }
    })
}

println('LAB9_METRICS_OK: 15s collection, 168h per-build metrics, live queue-wait gauge')
