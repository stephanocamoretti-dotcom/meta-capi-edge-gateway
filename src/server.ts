import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { dispatchCapiEventWithRetry, type ConversionPayload } from './capi/dispatcher.js';

const app = new Hono();

function extractCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'meta-capi-edge-gateway',
    graphVersion: process.env.META_GRAPH_VERSION ?? 'v27.0',
  })
);

app.post('/v1/track', async (c) => {
  const body = (await c.req.json()) as ConversionPayload;
  if (!body?.eventName || !body?.eventId) {
    return c.json({ error: 'eventName and deterministic eventId are required for deduplication.' }, 400);
  }

  const cookieHeader = c.req.header('cookie');
  const forwardedIp = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const userAgent = c.req.header('user-agent');

  const enriched: ConversionPayload = {
    ...body,
    userData: {
      ...body.userData,
      clientIpAddress: body.userData?.clientIpAddress ?? forwardedIp,
      clientUserAgent: body.userData?.clientUserAgent ?? userAgent,
      fbc: body.userData?.fbc ?? extractCookie(cookieHeader, '_fbc'),
      fbp: body.userData?.fbp ?? extractCookie(cookieHeader, '_fbp'),
    },
  };

  const result = await dispatchCapiEventWithRetry(enriched, {
    pixelId: process.env.META_PIXEL_ID ?? '',
    accessToken: process.env.META_ACCESS_TOKEN ?? '',
    graphVersion: process.env.META_GRAPH_VERSION ?? 'v27.0',
    testEventCode: process.env.META_TEST_EVENT_CODE || undefined,
  });

  return c.json(result);
});

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`[meta-capi-edge-gateway] listening on http://localhost:${port}`);
});
