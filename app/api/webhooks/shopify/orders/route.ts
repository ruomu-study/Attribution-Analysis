import {NextResponse} from "next/server";
import {getRequiredEnv} from "@/lib/env";
import {upsertShopifyOrder, upsertShopifyRefund} from "@/lib/orders";
import {verifyShopifyWebhook} from "@/lib/shopify-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  const topic = request.headers.get("x-shopify-topic");
  const secret = getRequiredEnv("SHOPIFY_WEBHOOK_SECRET");

  if (!verifyShopifyWebhook(rawBody, hmac, secret)) {
    return NextResponse.json({ok: false, error: "invalid_hmac"}, {status: 401});
  }

  try {
    const payload = JSON.parse(rawBody);

    if (topic?.startsWith("orders/")) {
      await upsertShopifyOrder(payload);
    }

    if (topic === "refunds/create") {
      await upsertShopifyRefund(payload);
    }

    return NextResponse.json({ok: true});
  } catch (error) {
    console.error(error);
    return NextResponse.json({ok: false, error: "webhook_failed"}, {status: 500});
  }
}
