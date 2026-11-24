import {
  estimateMatchQuality,
  normalizeAndHashUserData,
  type RawUserData,
} from './hash-and-emq.js';

export interface ConversionPayload {
  eventName: 'Purchase' | 'Lead' | 'InitiateCheckout' | 'AddToCart' | 'ViewContent' | string;
  eventId: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource?: 'website' | 'app' | 'phone_call' | 'chat' | 'system_generated';
  userData: RawUserData;
  customData?: {
    currency?: string;
    value?: number;
    content_ids?: string[];
    content_type?: string;
    order_id?: string;
    [key: string]: unknown;
  };
}

export interface CapiConfig {
  pixelId: string;
  accessToken: string;
  graphVersion: string;
  testEventCode?: string;
}

export async function dispatchCapiEventWithRetry(
  input: ConversionPayload,
  config: CapiConfig,
  maxRetries = 3
) {
  const user_data = await normalizeAndHashUserData(input.userData);
  const emq = estimateMatchQuality(user_data);

  const eventBody: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: input.actionSource ?? 'website',
        event_source_url: input.eventSourceUrl,
        user_data,
        custom_data: input.customData,
      },
    ],
  };

  if (config.testEventCode) {
    eventBody.test_event_code = config.testEventCode;
  }

  if (!config.pixelId || !config.accessToken) {
    return {
      status: 'dry_run',
      emq,
      dispatchedPayload: eventBody,
    };
  }

  const endpoint = `https://graph.facebook.com/${config.graphVersion}/${config.pixelId}/events?access_token=${encodeURIComponent(config.accessToken)}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventBody),
      });

      const json = (await res.json()) as Record<string, unknown>;
      if (res.ok) {
        return { status: 'sent', attempt, emq, metaResponse: json };
      }

      // Retry only on rate limit (429) or transient 5xx
      if (res.status !== 429 && res.status < 500) {
        return { status: 'rejected', httpStatus: res.status, emq, metaResponse: json };
      }
      lastError = json;
    } catch (err) {
      lastError = err;
    }

    const backoffMs = 250 * Math.pow(2, attempt - 1);
    await new Promise((r) => setTimeout(r, backoffMs));
  }

  throw new Error(`Meta CAPI failed after ${maxRetries} attempts: ${JSON.stringify(lastError)}`);
}
