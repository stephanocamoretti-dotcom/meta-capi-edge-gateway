/**
 * Lightweight browser helper that fires Meta Pixel and forwards the exact same
 * deterministic event_id + _fbc/_fbp cookies to the server-side CAPI gateway.
 */
declare global {
  interface Window {
    fbq?: (command: string, event: string, params?: Record<string, unknown>, options?: { eventID: string }) => void;
  }
}

export async function trackWithDeduplication(
  gatewayUrl: string,
  eventName: string,
  customData: Record<string, unknown> = {},
  userData: Record<string, string> = {}
): Promise<{ eventId: string }> {
  const eventId = crypto.randomUUID();

  // 1. Client-side Meta Pixel (browser)
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    window.fbq('track', eventName, customData, { eventID: eventId });
  }

  // 2. Server-side CAPI Gateway with identical eventId
  const fbclid = new URLSearchParams(window.location.search).get('fbclid') ?? undefined;
  await fetch(`${gatewayUrl}/v1/track`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
      userData: { ...userData, fbclid },
      customData,
    }),
  });

  return { eventId };
}
