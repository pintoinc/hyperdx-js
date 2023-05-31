import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

import { patchConsoleLog } from './patch';
import { name as PKG_NAME, version as PKG_VERSION } from '../package.json';

const LOG_PREFIX = `[${PKG_NAME} v${PKG_VERSION}]`;

const env = process.env;

// set default otel env vars
env.OTEL_EXPORTER_OTLP_ENDPOINT =
  env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'https://in-otel.hyperdx.io';
env.OTEL_NODE_RESOURCE_DETECTORS = env.OTEL_NODE_RESOURCE_DETECTORS ?? 'all';
env.OTEL_LOG_LEVEL = env.OTEL_LOG_LEVEL ?? 'info';

// patch OTEL_EXPORTER_OTLP_HEADERS to include API key
if (env.HYPERDX_API_KEY) {
  env.OTEL_EXPORTER_OTLP_HEADERS = `${env.OTEL_EXPORTER_OTLP_HEADERS},authorization=${env.HYPERDX_API_KEY}`;
}

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    timeoutMillis: 60000,
  }),
  // metricReader: metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      // FIXME: issue detected with fs instrumentation (infinite loop)
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

if (env.OTEL_EXPORTER_OTLP_ENDPOINT && env.OTEL_EXPORTER_OTLP_HEADERS) {
  console.warn(`${LOG_PREFIX} Tracing is enabled...`);
  sdk.start();
} else {
  console.warn(
    `${LOG_PREFIX} OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS are not set, tracing is disabled`,
  );
}

// patch console.log
patchConsoleLog();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(
      () => console.log(`${LOG_PREFIX} otel SDK shut down successfully`),
      (err) => console.log(`${LOG_PREFIX} Error shutting down otel SDK`, err),
    )
    .finally(() => process.exit(0));
});
