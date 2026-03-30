import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mockAppointmentFindOne,
  mockUserFindOne,
  resetWebhookEnvironment,
  restoreWebhookEnvironment,
  webhook,
} from "./webhookTestHelpers";

/*
  Pruebas de generación de menú y validación de fecha.
  Comprueba que el texto del menú y los mensajes de error sean correctos.
*/

describe("Menú y validación de fecha", () => {
  beforeEach(() => {
    resetWebhookEnvironment();
  });

  afterEach(() => {
    restoreWebhookEnvironment();
  });

  it("genera el menú correcto para un usuario sin cita", async () => {
    await mockUserFindOne(null);
    await mockAppointmentFindOne(null);

    const menu = await webhook.buildMenu("52123456789");

    expect(menu).toContain("1️⃣ Registrarme");
    expect(menu).not.toContain("2️⃣ Agendar cita");
  });

  it("muestra error cuando la fecha ingresada no es válida", async () => {
    const session = { step: "APPOINTMENT_DATE", whatsapp: "52123456789" };

    const response = await webhook.fechaCita(
      "52123456789",
      "invalid-date",
      session as any,
    );

    expect(response).toContain("Fecha inválida");
    expect(session.step).toBe("APPOINTMENT_DATE");
  });
});
