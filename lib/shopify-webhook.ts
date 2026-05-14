import crypto from "crypto";

export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string): boolean {
  if (!hmacHeader) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const digestBuffer = Buffer.from(digest, "utf8");
  const headerBuffer = Buffer.from(hmacHeader, "utf8");

  if (digestBuffer.length !== headerBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, headerBuffer);
}
