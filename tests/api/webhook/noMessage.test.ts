import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRequest,
  resetWebhookEnvironment,
  restoreWebhookEnvironment,
  webhook,
} from "./webhookTestHelpers";

/*
  Prueba de comportamiento cuando llega una petición válida
  que no contiene un mensaje de WhatsApp.
*/

describe("Webhook POST sin mensaje", () => {
  beforeEach(() => {
    resetWebhookEnvironment();
  });

  afterEach(() => {
    restoreWebhookEnvironment();
  });

  it("devuelve ok y no intenta enviar mensaje", async () => {
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createRequest("https://example.com/api/webhook", { entry: [] });

    const response = await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(await response.json()).toEqual({ ok: true });
    expect(sendMessageSpy).not.toHaveBeenCalled();
  });
});
