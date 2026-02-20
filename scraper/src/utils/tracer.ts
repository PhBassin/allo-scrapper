import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { trace, type Tracer } from '@opentelemetry/api';

const SERVICE_NAME = 'ics-scraper';
const SERVICE_VERSION = '1.0.0';

let _sdk: NodeSDK | null = null;

/**
 * Initialise the OpenTelemetry SDK with OTLP gRPC export to Tempo.
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * Set OTEL_EXPORTER_OTLP_ENDPOINT to the Tempo gRPC endpoint (default: http://ics-tempo:4317).
 * Set OTEL_ENABLED=false to disable tracing (e.g. in tests or dev).
 */
export function initTracing(): void {
  if (_sdk) return; // Already initialised
  if (process.env.OTEL_ENABLED === 'false') return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://ics-tempo:4317';

  const exporter = new OTLPTraceExporter({ url: endpoint });

  _sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
      [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy fs instrumentation
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  _sdk.start();
}

/**
 * Returns a tracer instance for the scraper service.
 * Call initTracing() first (done in main() entry point).
 */
export function getTracer(): Tracer {
  return trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
}
