import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterGRPC } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';

import packageInfo from '../package.json';

if (process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  const meterProvider = new MeterProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: `${packageInfo.name}`,
      [SemanticResourceAttributes.SERVICE_VERSION]: `${packageInfo.version}`,
    }),
  });

  let metricExporter;
  if (
    process.env.OTEL_EXPORTER_OTLP_PROTOCOL === 'grpc' ||
    process.env.OTEL_EXPORTER_OTLP_METRICS_PROTOCOL === 'grpc'
  ) {
    metricExporter = new OTLPMetricExporterGRPC();
  } else {
    metricExporter = new OTLPMetricExporter();
  }

  meterProvider.addMetricReader(
    new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 60000,
    })
  );

  metrics.setGlobalMeterProvider(meterProvider);
}

if (process.env.OTEL_EXPORTER_DEBUG) {
  diag.disable();
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}
