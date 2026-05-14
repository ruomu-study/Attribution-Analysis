import crypto from "crypto";
import {getPool} from "@/lib/db";

function money(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hashEmail(email: unknown): string | null {
  if (typeof email !== "string" || !email.trim()) {
    return null;
  }

  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export async function upsertShopifyOrder(order: Record<string, any>) {
  const pool = getPool();
  const client = await pool.connect();
  const orderId = String(order.id);
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];

  try {
    await client.query("begin");

    await client.query(
      `
        insert into orders (
          shopify_order_id,
          order_name,
          checkout_token,
          cart_token,
          email_hash,
          customer_id,
          financial_status,
          fulfillment_status,
          cancelled_at,
          paid_at,
          processed_at,
          currency,
          subtotal_price,
          total_tax,
          total_shipping,
          total_price,
          raw_payload,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, now()
        )
        on conflict (shopify_order_id) do update set
          order_name = excluded.order_name,
          checkout_token = excluded.checkout_token,
          cart_token = excluded.cart_token,
          email_hash = excluded.email_hash,
          customer_id = excluded.customer_id,
          financial_status = excluded.financial_status,
          fulfillment_status = excluded.fulfillment_status,
          cancelled_at = excluded.cancelled_at,
          paid_at = excluded.paid_at,
          processed_at = excluded.processed_at,
          currency = excluded.currency,
          subtotal_price = excluded.subtotal_price,
          total_tax = excluded.total_tax,
          total_shipping = excluded.total_shipping,
          total_price = excluded.total_price,
          raw_payload = excluded.raw_payload,
          updated_at = now()
      `,
      [
        orderId,
        order.name || null,
        order.checkout_token || null,
        order.cart_token || null,
        hashEmail(order.email),
        order.customer?.id ? String(order.customer.id) : null,
        order.financial_status || null,
        order.fulfillment_status || null,
        order.cancelled_at ? new Date(order.cancelled_at) : null,
        order.processed_at && order.financial_status === "paid" ? new Date(order.processed_at) : null,
        order.processed_at ? new Date(order.processed_at) : null,
        order.currency || null,
        money(order.subtotal_price),
        money(order.total_tax),
        money(order.total_shipping_price_set?.shop_money?.amount),
        money(order.total_price),
        order
      ]
    );

    await client.query("delete from order_items where shopify_order_id = $1", [orderId]);

    for (const item of lineItems) {
      await client.query(
        `
          insert into order_items (
            shopify_order_id,
            line_item_id,
            product_id,
            variant_id,
            sku,
            title,
            quantity,
            price,
            raw_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          orderId,
          item.id ? String(item.id) : null,
          item.product_id ? String(item.product_id) : null,
          item.variant_id ? String(item.variant_id) : null,
          item.sku || null,
          item.title || null,
          Number.isInteger(item.quantity) ? item.quantity : null,
          money(item.price),
          item
        ]
      );
    }

    await client.query("commit");

    return {ok: true, orderId};
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function upsertShopifyRefund(refund: Record<string, any>) {
  const pool = getPool();
  const refundId = String(refund.id);
  const transactions = Array.isArray(refund.transactions) ? refund.transactions : [];
  const totalRefunded = transactions.reduce((sum: number, transaction: Record<string, any>) => {
    return sum + (money(transaction.amount) || 0);
  }, 0);

  await pool.query(
    `
      insert into refunds (
        shopify_refund_id,
        shopify_order_id,
        processed_at,
        total_refunded,
        currency,
        raw_payload,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, now())
      on conflict (shopify_refund_id) do update set
        shopify_order_id = excluded.shopify_order_id,
        processed_at = excluded.processed_at,
        total_refunded = excluded.total_refunded,
        currency = excluded.currency,
        raw_payload = excluded.raw_payload,
        updated_at = now()
    `,
    [
      refundId,
      refund.order_id ? String(refund.order_id) : null,
      refund.processed_at ? new Date(refund.processed_at) : null,
      totalRefunded || null,
      transactions[0]?.currency || null,
      refund
    ]
  );

  return {ok: true, refundId};
}
