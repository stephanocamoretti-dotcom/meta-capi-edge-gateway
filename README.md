<p align="right">
  <a href="./README.es.md">🇪🇸 Leer en Español</a>
</p>

<p align="center">
  <img src="./assets/banner.svg" alt="Meta CAPI Edge Gateway Banner" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Hono-Edge_Ready-38BDF8?style=for-the-badge&logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/Meta_CAPI-Graph_v27.0-34D399?style=for-the-badge&logo=meta&logoColor=white" alt="Meta CAPI" />
  <img src="https://img.shields.io/badge/License-MIT-818CF8?style=for-the-badge" alt="MIT License" />
</p>

# meta-capi-edge-gateway

A lightweight, edge-ready **Server-Side Tracking & AdTech Attribution Gateway** built with **TypeScript + Hono** for **Meta Conversions API (CAPI)**. It handles deterministic `event_id` deduplication with the browser Meta Pixel, WebCrypto **SHA-256 PII normalization**, automatic `_fbc`/`_fbp` extraction, pre-flight **Event Match Quality (EMQ)** scoring, and exponential-backoff retries.

---

## Why Server-Side CAPI + Deduplication

<p align="center">
  <img src="./assets/emq-signal-comparison.svg" alt="Browser Pixel vs Server-Side CAPI Gateway" width="100%" />
</p>

---

## Deduplication & Dispatch Flow

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Browser Pixel Bridge
    participant Gateway as Hono Edge Gateway
    participant Scorer as SHA-256 + EMQ Scorer
    participant Meta as Meta Graph API Events

    Browser->>Meta: fbq track Purchase with eventID
    Browser->>Gateway: POST /v1/track with same eventId + cookies
    Gateway->>Scorer: Normalize & hash PII + extract fbc/fbp
    Scorer-->>Gateway: EMQ score + formatted user_data
    Gateway->>Meta: POST /events with exponential backoff retry
```

---

## Quick Start

```bash
git clone https://github.com/stephanocamoretti-dotcom/meta-capi-edge-gateway.git
cd meta-capi-edge-gateway
npm install
cp .env.example .env
# Add META_PIXEL_ID and META_ACCESS_TOKEN (or leave blank for dry-run EMQ testing)
npm run dev
```

Send a test conversion event:

```bash
curl -X POST http://localhost:8787/v1/track \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "Purchase",
    "eventId": "ord_9918273",
    "userData": { "email": "Founder@Example.com", "phone": "+1 555-234-5678", "fbclid": "IwAR3demo" },
    "customData": { "currency": "USD", "value": 149.00 }
  }'
```

---

## Scaling Ideas for Production

1. **Cloudflare Workers + Queues**: Because the gateway uses `Hono` and standard `webcrypto.subtle`, deploy it to Cloudflare Workers at the edge and offload `dispatchCapiEventWithRetry` to a Cloudflare Queue for zero-latency checkout responses.
2. **Multi-Account / Agency Routing**: Resolve `pixelId` and `accessToken` dynamically from a `X-Tenant-ID` header backed by Redis/KV so one gateway serves dozens of e-commerce brands.
3. **AdTech Fan-Out**: Mirror the normalized payload from `/v1/track` to **Google Ads Enhanced Conversions**, **TikTok Events API**, and your internal warehouse (BigQuery / ClickHouse) for unified attribution.
4. **Offline / CRM LTV Sync**: Trigger `Purchase` or `Subscribe` events directly from Stripe webhooks, Shopify Flow, or AI Voice/WhatsApp closers using `actionSource: "system_generated"`.

---

## References

- [Meta for Developers — Conversions API: Using the API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api)
- [Meta Graph API v27.0 & Marketing API v27.0 Release](https://developers.facebook.com/blog/post/2026/11/04/introducing-graph-api-v27-and-marketing-api-v27/)
- [Hono — Ultrafast Web Framework for the Edges](https://hono.dev/)
