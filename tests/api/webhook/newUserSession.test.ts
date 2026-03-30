import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWhatsAppWebhookRequest,
  mockConnectDB,
  mockUserFindOne,
  resetWebhookEnvironment,
  restoreWebhookEnvironment,
  webhook,
} from "./webhookTestHelpers";

/*
  Prueba del flujo de usuario nuevo.
  Aquí simulamos que una persona escribe por primera vez
  y el chatbot debe enviar un mensaje de bienvenida.
*/

describe("Webhook POST para usuario nuevo", () => {
  beforeEach(() => {
    resetWebhookEnvironment();
  });

  afterEach(() => {
    restoreWebhookEnvironment();
  });

  it("crea una sesión y envía bienvenida cuando el usuario es nuevo", async () => {
    const User = await mockUserFindOne(null);
    const connectDBSpy = await mockConnectDB();
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "hola");

    const response = await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(await response.json()).toEqual({ ok: true });
    expect(connectDBSpy).toHaveBeenCalled();
    expect(User.findOne).toHaveBeenCalledWith({ whatsapp: "524123456789" });
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][0]).toBe("524123456789");
    expect(sendMessageSpy.mock.calls[0][1]).toContain("¡Bienvenido");
    expect(webhook.sessions.get("524123456789")?.step).toBe("AWAITING_MENU");
  });
});
