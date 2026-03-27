import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createVerificationRequest,
  resetWebhookEnvironment,
  restoreWebhookEnvironment,
  webhook,
} from "./webhookTestHelpers";

/*
  Pruebas de verificación del webhook.
  Aquí comprobamos que la URL de verificación funcione como espera WhatsApp.
*/

describe("Webhook verification", () => {
  beforeEach(() => {
    resetWebhookEnvironment();
  });

  afterEach(() => {
    restoreWebhookEnvironment();
  });

  it("verifica el webhook con token válido", async () => {
    process.env.VERIFY_TOKEN = "valid-token";
    const req = createVerificationRequest("valid-token", "abc123");

    const response = await webhook.handleWebhookGet(req);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("abc123");
  });

  it("rechaza el webhook con token inválido", async () => {
    process.env.VERIFY_TOKEN = "valid-token";
    const req = createVerificationRequest("wrong-token", "abc123");

    const response = await webhook.handleWebhookGet(req);

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });
});
