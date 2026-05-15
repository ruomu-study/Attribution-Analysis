const COLLECT_URL = "https://your-domain.com/api/events/collect";
const COLLECT_SECRET = "replace_with_optional_shared_secret";

const TRACKED_EVENTS = [
  "page_viewed",
  "product_viewed",
  "product_added_to_cart",
  "product_removed_from_cart",
  "cart_viewed",
  "checkout_started",
  "checkout_contact_info_submitted",
  "checkout_shipping_info_submitted",
  "payment_info_submitted",
  "checkout_completed"
];

const CUSTOM_EVENT_PREFIX = "attribution_analysis:";
const TRACKED_CUSTOM_EVENTS = [
  "attribution_analysis:collection_product_impression",
  "attribution_analysis:collection_product_click",
  "attribution_analysis:product_media_viewed",
  "attribution_analysis:product_media_clicked",
  "attribution_analysis:add_to_cart_attribution_snapshot"
];

const VISITOR_COOKIE = "aa_visitor_id";
const SESSION_COOKIE = "aa_session_id";
const LANDING_COOKIE = "aa_landing_page";
const SESSION_TTL_MINUTES = 30;

function randomId(prefix) {
  const random = Math.random().toString(36).slice(2);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

async function getCookie(name) {
  try {
    return await browser.cookie.get(name);
  } catch (_error) {
    return null;
  }
}

async function setCookie(name, value, minutes) {
  try {
    const expires = new Date(Date.now() + minutes * 60 * 1000).toUTCString();
    await browser.cookie.set(`${name}=${value}; expires=${expires}; path=/; SameSite=Lax`);
  } catch (_error) {
    // Pixel collection should continue even if browser cookie APIs are blocked.
  }
}

function parseUrl(url) {
  try {
    return new URL(url);
  } catch (_error) {
    return null;
  }
}

function queryParam(url, name) {
  const parsed = parseUrl(url);
  return parsed ? parsed.searchParams.get(name) : null;
}

function getDevice(userAgent) {
  if (!userAgent) return "unknown";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  if (/ipad|tablet/i.test(userAgent)) return "tablet";
  return "desktop";
}

function firstLineItem(checkout) {
  return checkout && Array.isArray(checkout.lineItems) && checkout.lineItems.length > 0 ? checkout.lineItems[0] : null;
}

function extractCommerce(event) {
  const data = event.data || {};
  const productVariant = data.productVariant || data.product?.variant || {};
  const product = data.product || productVariant.product || {};
  const cartLine = data.cartLine || {};
  const checkout = data.checkout || {};
  const item = firstLineItem(checkout) || {};

  return {
    product_id: product.id || productVariant.product?.id || cartLine.merchandise?.product?.id || item.variant?.product?.id || null,
    variant_id: productVariant.id || cartLine.merchandise?.id || item.variant?.id || null,
    product_title: product.title || cartLine.merchandise?.product?.title || item.title || null,
    cart_value: data.cart?.cost?.totalAmount?.amount || checkout.totalPrice?.amount || null,
    currency: data.cart?.cost?.totalAmount?.currencyCode || checkout.currencyCode || checkout.totalPrice?.currencyCode || null,
    checkout_token: checkout.token || checkout.id || null,
    order_id: checkout.order?.id || null
  };
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCustomAttribution(event) {
  const data = event.customData || {};

  const payload = {
    surface: data.surface || null,
    list_name: data.list_name || null,
    card_position: toNumber(data.card_position),
    media_id: data.media_id ? String(data.media_id) : null,
    media_url: data.media_url || null,
    media_position: toNumber(data.media_position),
    media_alt: data.media_alt || null,
    product_id: data.product_id ? String(data.product_id) : null,
    variant_id: data.variant_id ? String(data.variant_id) : null,
    product_title: data.product_title || null,
    product_handle: data.product_handle || null,
    interaction_target: data.interaction_target || null
  };

  return Object.fromEntries(Object.entries(payload).filter((entry) => entry[1] !== null && entry[1] !== undefined));
}

async function buildPayload(event) {
  const pageUrl = event.context?.document?.location?.href || event.context?.window?.location?.href || "";
  const referrer = event.context?.document?.referrer || "";
  const userAgent = event.context?.navigator?.userAgent || "";
  const clientId = event.clientId || null;

  let visitorId = await getCookie(VISITOR_COOKIE);
  if (!visitorId) {
    visitorId = clientId || randomId("visitor");
    await setCookie(VISITOR_COOKIE, visitorId, 60 * 24 * 365);
  }

  let sessionId = await getCookie(SESSION_COOKIE);
  if (!sessionId) {
    sessionId = randomId("session");
    await setCookie(LANDING_COOKIE, pageUrl, SESSION_TTL_MINUTES);
  }
  await setCookie(SESSION_COOKIE, sessionId, SESSION_TTL_MINUTES);

  const landingPage = (await getCookie(LANDING_COOKIE)) || pageUrl;
  const commerce = extractCommerce(event);
  const customAttribution = extractCustomAttribution(event);

  return {
    event_id: event.id,
    event_name: event.name,
    event_time: event.timestamp,
    shop_domain: init?.context?.shop?.myshopifyDomain || init?.data?.shop?.myshopifyDomain || null,
    client_id: clientId,
    visitor_id: visitorId,
    session_id: sessionId,
    page_url: pageUrl,
    page_title: event.context?.document?.title || null,
    landing_page: landingPage,
    referrer,
    utm_source: queryParam(pageUrl, "utm_source"),
    utm_medium: queryParam(pageUrl, "utm_medium"),
    utm_campaign: queryParam(pageUrl, "utm_campaign"),
    utm_content: queryParam(pageUrl, "utm_content"),
    utm_term: queryParam(pageUrl, "utm_term"),
    gclid: queryParam(pageUrl, "gclid"),
    fbclid: queryParam(pageUrl, "fbclid"),
    ttclid: queryParam(pageUrl, "ttclid"),
    device: getDevice(userAgent),
    country: event.context?.navigator?.language || null,
    ...commerce,
    ...customAttribution,
    raw_event: event
  };
}

async function sendEvent(event) {
  const payload = await buildPayload(event);

  fetch(COLLECT_URL, {
    method: "POST",
    keepalive: true,
    headers: {
      "content-type": "application/json",
      "x-attribution-secret": COLLECT_SECRET
    },
    body: JSON.stringify(payload)
  });
}

analytics.subscribe("all_standard_events", async (event) => {
  if (!TRACKED_EVENTS.includes(event.name)) {
    return;
  }

  await sendEvent(event);
});

analytics.subscribe("all_custom_events", async (event) => {
  if (!event.name.startsWith(CUSTOM_EVENT_PREFIX) || !TRACKED_CUSTOM_EVENTS.includes(event.name)) {
    return;
  }

  await sendEvent(event);
});
