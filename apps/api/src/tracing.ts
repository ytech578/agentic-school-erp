import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

export const otelSDK = new NodeSDK({
  traceExporter: new (require('@opentelemetry/sdk-trace-base').ConsoleSpanExporter)(),
  instrumentations: [getNodeAutoInstrumentations()],
});

// Start SDK gracefully
if (process.env.ENABLE_TRACING === 'true') {
  otelSDK.start();
}
