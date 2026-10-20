import { json } from 'express';
import type { IncomingMessage } from 'node:http';

export function apiJsonParser() {
  return json({
    // SCIM clients send this registered JSON media type, not application/json.
    type: ['application/json', 'application/scim+json'],
    limit: '25mb',
    verify: (request, _response, buffer) => {
      (request as IncomingMessage & { rawBody?: Buffer }).rawBody = buffer;
    },
  });
}
