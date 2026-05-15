export type Channel =
  | "paid_search"
  | "paid_social"
  | "organic_search"
  | "organic_social"
  | "email"
  | "sms"
  | "affiliate"
  | "referral"
  | "direct"
  | "unknown";

const searchHosts = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu."];
const socialHosts = ["facebook.", "instagram.", "t.co", "twitter.", "x.com", "pinterest.", "tiktok.", "linkedin."];

export function classifyChannel(input: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
}): Channel {
  const source = input.utmSource?.toLowerCase() || "";
  const medium = input.utmMedium?.toLowerCase() || "";
  const campaign = input.utmCampaign?.toLowerCase() || "";
  const referrer = input.referrer?.toLowerCase() || "";

  if (
    input.gclid ||
    medium.includes("cpc") ||
    medium.includes("ppc") ||
    medium.includes("paidsearch") ||
    medium.includes("paid_search") ||
    medium.includes("shopping")
  ) {
    return "paid_search";
  }

  if (input.fbclid || medium.includes("paid_social") || medium.includes("paidsocial")) {
    return "paid_social";
  }

  if (["facebook", "instagram", "meta", "tiktok", "pinterest"].some((name) => source.includes(name)) && medium.includes("paid")) {
    return "paid_social";
  }

  if (medium === "email" || source.includes("klaviyo") || source.includes("mailchimp")) {
    return "email";
  }

  if (medium === "sms" || source.includes("sms")) {
    return "sms";
  }

  if (medium.includes("affiliate") || source.includes("affiliate")) {
    return "affiliate";
  }

  if (
    medium.includes("product_sync") ||
    medium.includes("organic_shopping") ||
    campaign.includes("sag_organic")
  ) {
    return "organic_search";
  }

  if (medium.includes("organic") && socialHosts.some((host) => source.includes(host.replace(".", "")))) {
    return "organic_social";
  }

  if (medium.includes("organic")) {
    return "organic_search";
  }

  if (referrer && searchHosts.some((host) => referrer.includes(host))) {
    return "organic_search";
  }

  if (referrer && socialHosts.some((host) => referrer.includes(host))) {
    return "organic_social";
  }

  if (referrer) {
    return "referral";
  }

  if (!source && !medium && !referrer) {
    return "direct";
  }

  return "unknown";
}
