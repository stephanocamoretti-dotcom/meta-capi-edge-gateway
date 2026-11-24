<p align="right">
  <a href="./README.md">🇺🇸 Read in English</a>
</p>

<p align="center">
  <img src="./assets/banner.svg" alt="Banner de Meta CAPI Edge Gateway" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.6-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Hono-Edge_Ready-38BDF8?style=for-the-badge&logo=hono&logoColor=white" alt="Hono" />
  <img src="https://img.shields.io/badge/Meta_CAPI-Graph_v27.0-34D399?style=for-the-badge&logo=meta&logoColor=white" alt="Meta CAPI" />
  <img src="https://img.shields.io/badge/License-MIT-818CF8?style=for-the-badge" alt="Licencia MIT" />
</p>

# meta-capi-edge-gateway

Gateway ligero y preparado para Edge de **Server-Side Tracking y atribución AdTech** construido con **TypeScript + Hono** para **Meta Conversions API (CAPI)**. Resuelve deduplicación determinista por `event_id` con el Pixel del navegador, normalización y hash **SHA-256** con WebCrypto, extracción automática de `_fbc`/`_fbp`, cálculo previo de **Event Match Quality (EMQ)** y reintentos con *exponential backoff*.

---

## Por qué CAPI Server-Side + Deduplicación

<p align="center">
  <img src="./assets/emq-signal-comparison.svg" alt="Comparativa Pixel vs Gateway CAPI Server-Side" width="100%" />
</p>

---

## Flujo de Deduplicación y Envío

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Bridge Pixel Navegador
    participant Gateway as Hono Edge Gateway
    participant Scorer as SHA-256 + Scorer EMQ
    participant Meta as Meta Graph API Events

    Browser->>Meta: fbq track Purchase con eventID
    Browser->>Gateway: POST /v1/track con mismo eventId y cookies
    Gateway->>Scorer: Normaliza y hashea PII + extrae fbc/fbp
    Scorer-->>Gateway: Puntaje EMQ + user_data formateado
    Gateway->>Meta: POST /events con reintentos backoff
```

---

## Inicio rápido

```bash
git clone https://github.com/stephanocamoretti-dotcom/meta-capi-edge-gateway.git
cd meta-capi-edge-gateway
npm install
cp .env.example .env
# Agrega META_PIXEL_ID y META_ACCESS_TOKEN (o déjalo vacío para modo dry-run)
npm run dev
```

---

## Ideas de escalado para producción

1. **Cloudflare Workers + Queues**: Al usar `Hono` y `webcrypto.subtle` estándar, puedes desplegarlo en Cloudflare Workers y enviar `dispatchCapiEventWithRetry` a una cola asíncrona para no añadir latencia al checkout.
2. **Enrutamiento Multi-Marca para Agencias**: Resuelve `pixelId` y `accessToken` dinámicamente mediante un header `X-Tenant-ID` respaldado por Redis/KV para operar decenas de cuentas desde un solo gateway.
3. **Fan-Out AdTech Unificado**: Replica el payload normalizado hacia **Google Ads Enhanced Conversions**, **TikTok Events API** y tu data warehouse (BigQuery / ClickHouse).
4. **Sincronización CRM / LTV Offline**: Dispara eventos `Purchase` o `Subscribe` directo desde webhooks de Stripe, Shopify o agentes de voz/WhatsApp usando `actionSource: "system_generated"`.

---

## Referencias

- [Meta for Developers — Conversions API: Using the API](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api)
- [Lanzamiento de Meta Graph API v27.0 y Marketing API v27.0](https://developers.facebook.com/blog/post/2026/11/04/introducing-graph-api-v27-and-marketing-api-v27/)
- [Hono — Framework Web Ultraligero para Edge](https://hono.dev/)
