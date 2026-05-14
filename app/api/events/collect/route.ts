import {NextResponse} from "next/server";
import {ZodError} from "zod";
import {getOptionalEnv} from "@/lib/env";
import {storeCollectedEvent} from "@/lib/events";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-attribution-secret"
};

function jsonWithCors(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers
    }
  });
}

export async function POST(request: Request) {
  const expectedSecret = getOptionalEnv("EVENT_COLLECT_SECRET");

  if (expectedSecret) {
    const providedSecret = request.headers.get("x-attribution-secret");

    if (providedSecret !== expectedSecret) {
      return jsonWithCors({ok: false, error: "unauthorized"}, {status: 401});
    }
  }

  try {
    const body = await request.json();
    const result = await storeCollectedEvent(body);

    return jsonWithCors(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonWithCors({ok: false, error: "invalid_event", details: error.flatten()}, {status: 400});
    }

    console.error(error);
    return jsonWithCors({ok: false, error: "internal_error"}, {status: 500});
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
