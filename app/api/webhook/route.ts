import { NextRequest } from "next/server";
import { handleWebhookGet, handleWebhookPost } from "./webhookService";

export async function GET(req: NextRequest) {
  return handleWebhookGet(req);
}

export async function POST(req: NextRequest) {
  return handleWebhookPost(req);
}
