import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRequest,
  createWhatsAppWebhookRequest,
  mockAppointmentCreate,
  mockAppointmentDelete,
  mockAppointmentFind,
  mockAppointmentFindOne,
  mockConnectDB,
  mockFindOrCreateUser,
  mockUserFindOne,
  mockUserUpdateOne,
  resetWebhookEnvironment,
  restoreWebhookEnvironment,
  webhook,
} from "./webhookTestHelpers";

/*
  Pruebas completas de los flujos de conversación que usa handleWebhookPost.
  Estas pruebas simulan los pasos de la conversación y validan
  el comportamiento esperado en cada estado.
*/

describe("Webhook POST conversation flows", () => {
  beforeEach(() => {
    resetWebhookEnvironment();
  });

  afterEach(() => {
    restoreWebhookEnvironment();
  });

  it("responde el menú cuando el usuario existente escribe 'menu'", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    await mockAppointmentFindOne(null);
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "menu");

    const response = await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(await response.json()).toEqual({ ok: true });
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Editar o ver mi información");
    expect(webhook.sessions.get("524123456789")?.step).toBe("AWAITING_MENU");
  });

  it("cancela la acción cuando el usuario escribe 'cancelar'", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "cancelar");

    const response = await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(await response.json()).toEqual({ ok: true });
    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Acción cancelada");
    expect(webhook.sessions.get("524123456789")?.step).toBe("DONE");
  });

  it("muestra las opciones de edición cuando el usuario elige 1 en el menú", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    await mockAppointmentFindOne(null);
    webhook.sessions.set("524123456789", {
      step: "AWAITING_MENU",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "1");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Editar mi nombre");
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Editar correo");
    expect(webhook.sessions.get("524123456789")?.step).toBe("EDIT_INFO");
  });

  it("pregunta la fecha cuando el usuario con cuenta existente elige 2 y no tiene cita", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    await mockAppointmentFindOne(null);
    webhook.sessions.set("524123456789", {
      step: "AWAITING_MENU",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "2");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("¿Qué fecha deseas?");
    expect(webhook.sessions.get("524123456789")?.step).toBe("APPOINTMENT_DATE");
  });

  it("advierte cuando el usuario intenta agendar y ya tiene cita", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    await mockAppointmentFindOne({ date: "2026-05-01", time: "09:00" });
    webhook.sessions.set("524123456789", {
      step: "AWAITING_MENU",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "2");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Ya tienes una cita agendada");
    expect(webhook.sessions.get("524123456789")?.step).toBe("DONE");
  });

  it("muestra la cita existente cuando el usuario elige 3", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    await mockAppointmentFindOne({ date: "2026-05-01", time: "09:00" });
    webhook.sessions.set("524123456789", {
      step: "AWAITING_MENU",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "3");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Tu cita");
    expect(sendMessageSpy.mock.calls[0][1]).toContain("2026-05-01");
  });

  it("pide confirmación de cancelación cuando el usuario elige 4", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    await mockAppointmentFindOne({
      _id: { toString: () => "abc123" },
      date: "2026-05-01",
      time: "09:00",
    });
    webhook.sessions.set("524123456789", {
      step: "AWAITING_MENU",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "4");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Confirmas cancelar");
    expect(webhook.sessions.get("524123456789")?.step).toBe("CONFIRM_CANCEL");
  });

  it("pide nombre cuando el usuario está en EDIT_INFO elige 1", async () => {
    webhook.sessions.set("524123456789", {
      step: "EDIT_INFO",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "1");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Introduce nuevo nombre");
    expect(webhook.sessions.get("524123456789")?.step).toBe("EDIT_NAME");
  });

  it("pide correo cuando el usuario está en EDIT_INFO elige 2", async () => {
    webhook.sessions.set("524123456789", {
      step: "EDIT_INFO",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "2");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Introduce nuevo correo");
    expect(webhook.sessions.get("524123456789")?.step).toBe("EDIT_EMAIL");
  });

  it("muestra datos cuando el usuario está en EDIT_INFO elige 3", async () => {
    await mockUserFindOne({
      whatsapp: "524123456789",
      name: "Juan",
      email: "juan@example.com",
    });
    webhook.sessions.set("524123456789", {
      step: "EDIT_INFO",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "3");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Mis datos");
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Juan");
    expect(webhook.sessions.get("524123456789")?.step).toBe("DONE");
  });

  it("actualiza el nombre cuando el usuario está en EDIT_NAME", async () => {
    await mockUserUpdateOne({});
    webhook.sessions.set("524123456789", {
      step: "EDIT_NAME",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "Nuevo Nombre");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Nombre actualizado");
    expect(webhook.sessions.get("524123456789")?.step).toBe("AWAITING_MENU");
  });

  it("rechaza email inválido cuando el usuario está en EDIT_EMAIL", async () => {
    webhook.sessions.set("524123456789", {
      step: "EDIT_EMAIL",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "bad-email");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Correo inválido");
    expect(webhook.sessions.get("524123456789")?.step).toBe("EDIT_EMAIL");
  });

  it("actualiza el correo cuando el usuario está en EDIT_EMAIL y el email es válido", async () => {
    await mockUserUpdateOne({});
    await mockUserFindOne({ whatsapp: "524123456789" });
    webhook.sessions.set("524123456789", {
      step: "EDIT_EMAIL",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "test@example.com");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Correo actualizado");
    expect(webhook.sessions.get("524123456789")?.step).toBe("AWAITING_MENU");
  });

  it("pide correo después de recibir el nombre en REGISTER_NAME", async () => {
    webhook.sessions.set("524123456789", {
      step: "REGISTER_NAME",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "Juan");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("¿Cuál es tu correo?");
    expect(webhook.sessions.get("524123456789")?.step).toBe("REGISTER_EMAIL");
  });

  it("rechaza correo inválido en REGISTER_EMAIL", async () => {
    const session = {
      step: "REGISTER_EMAIL",
      whatsapp: "524123456789",
      name: "Juan",
    };
    webhook.sessions.set("524123456789", session);
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "bad-email");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Correo inválido");
    expect(webhook.sessions.get("524123456789")?.step).toBe("REGISTER_EMAIL");
  });

  it("advierte si el correo ya está registrado en REGISTER_EMAIL", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    webhook.sessions.set("524123456789", {
      step: "REGISTER_EMAIL",
      whatsapp: "524123456789",
      name: "Juan",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "juan@example.com");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Ya estás registrado");
    expect(webhook.sessions.get("524123456789")?.step).toBe("DONE");
  });

  it("registra un usuario nuevo correctamente en REGISTER_EMAIL", async () => {
    await mockUserFindOne(null);
    await mockFindOrCreateUser({
      whatsapp: "524123456789",
      name: "Juan",
      email: "juan@example.com",
    });
    webhook.sessions.set("524123456789", {
      step: "REGISTER_EMAIL",
      whatsapp: "524123456789",
      name: "Juan",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "juan@example.com");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(2);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Registro completo");
    expect(sendMessageSpy.mock.calls[1][1]).toContain("Menú principal");
    expect(webhook.sessions.get("524123456789")?.step).toBe("AWAITING_MENU");
  });

  it("muestra error de fecha cuando APPOINTMENT_DATE recibe una fecha inválida", async () => {
    webhook.sessions.set("524123456789", {
      step: "APPOINTMENT_DATE",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "fecha invalida");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Fecha inválida");
    expect(webhook.sessions.get("524123456789")?.step).toBe("APPOINTMENT_DATE");
  });

  it("muestra horarios disponibles cuando APPOINTMENT_DATE recibe una fecha válida", async () => {
    await mockAppointmentFind([]);
    webhook.sessions.set("524123456789", {
      step: "APPOINTMENT_DATE",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "2026-05-01");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Horarios disponibles");
    expect(webhook.sessions.get("524123456789")?.step).toBe("APPOINTMENT_TIME");
    expect(webhook.sessions.get("524123456789")?.available).toBeDefined();
  });

  it("informa cuando no hay horarios disponibles para una fecha", async () => {
    const busyAppointments = [
      { time: "09:00" },
      { time: "10:00" },
      { time: "11:00" },
      { time: "12:00" },
      { time: "13:00" },
      { time: "14:00" },
      { time: "15:00" },
      { time: "16:00" },
      { time: "17:00" },
      { time: "18:00" },
    ];
    await mockAppointmentFind(busyAppointments);
    webhook.sessions.set("524123456789", {
      step: "APPOINTMENT_DATE",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "2026-05-01");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("No hay horarios disponibles");
  });

  it("rechaza horario inválido cuando APPOINTMENT_TIME recibe un número fuera de rango", async () => {
    webhook.sessions.set("524123456789", {
      step: "APPOINTMENT_TIME",
      whatsapp: "524123456789",
      available: ["09:00", "10:00"],
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "5");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Opción inválida");
    expect(webhook.sessions.get("524123456789")?.step).toBe("APPOINTMENT_TIME");
  });

  it("confirma el resumen de cita cuando APPOINTMENT_TIME recibe una opción válida", async () => {
    webhook.sessions.set("524123456789", {
      step: "APPOINTMENT_TIME",
      whatsapp: "524123456789",
      date: "2026-05-01",
      available: ["09:00", "10:00"],
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "1");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Resumen de tu cita");
    expect(webhook.sessions.get("524123456789")?.step).toBe("CONFIRM_APPOINTMENT");
  });

  it("advierte si ya existe cita al confirmar con 1 en CONFIRM_APPOINTMENT", async () => {
    await mockAppointmentFindOne({ userWhatsapp: "524123456789" });
    webhook.sessions.set("524123456789", {
      step: "CONFIRM_APPOINTMENT",
      whatsapp: "524123456789",
      date: "2026-05-01",
      selectedTime: "09:00",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "1");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Ya tienes una cita activa");
    expect(webhook.sessions.get("524123456789")?.step).toBe("DONE");
  });

  it("crea la cita cuando CONFIRM_APPOINTMENT recibe 1 y no hay cita previa", async () => {
    await mockAppointmentFindOne(null);
    await mockAppointmentCreate({
      userWhatsapp: "524123456789",
      date: "2026-05-01",
      time: "09:00",
    });
    webhook.sessions.set("524123456789", {
      step: "CONFIRM_APPOINTMENT",
      whatsapp: "524123456789",
      date: "2026-05-01",
      selectedTime: "09:00",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "1");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Cita confirmada");
    expect(webhook.sessions.get("524123456789")?.step).toBe("DONE");
  });

  it("cancela el flujo cuando CONFIRM_APPOINTMENT recibe 2", async () => {
    webhook.sessions.set("524123456789", {
      step: "CONFIRM_APPOINTMENT",
      whatsapp: "524123456789",
      date: "2026-05-01",
      selectedTime: "09:00",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "2");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Cita cancelada");
    expect(webhook.sessions.get("524123456789")?.step).toBe("DONE");
  });

  it("elimina la cita cuando CONFIRM_CANCEL recibe 1", async () => {
    await mockAppointmentDelete(null);
    webhook.sessions.set("524123456789", {
      step: "CONFIRM_CANCEL",
      whatsapp: "524123456789",
      cancelAppointmentId: "abc123",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "1");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Tu cita ha sido cancelada");
    expect(webhook.sessions.get("524123456789")?.step).toBe("MENU");
    expect(
      webhook.sessions.get("524123456789")?.cancelAppointmentId,
    ).toBeUndefined();
  });

  it("regresa al menú cuando CONFIRM_CANCEL recibe 2", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    webhook.sessions.set("524123456789", {
      step: "CONFIRM_CANCEL",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "2");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(sendMessageSpy.mock.calls[0][1]).toContain("Menú principal");
    expect(webhook.sessions.get("524123456789")?.step).toBe("AWAITING_MENU");
  });

  it("envía el segundo mensaje si regresoAMenu define segundoMensaje", async () => {
    await mockUserFindOne(null);
    await mockFindOrCreateUser({ whatsapp: "524123456789" });
    webhook.sessions.set("524123456789", {
      step: "REGISTER_EMAIL",
      whatsapp: "524123456789",
      name: "Juan",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "juan@example.com");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(2);
    expect(sendMessageSpy.mock.calls[1][1]).toContain("Menú principal");
  });

  it("usa normalizeWhatsapp para corregir el formato de número 5214...", async () => {
    await mockUserFindOne({ whatsapp: "524123456789" });
    await mockAppointmentFindOne(null);
    webhook.sessions.set("524123456789", {
      step: "AWAITING_MENU",
      whatsapp: "524123456789",
    });
    const sendMessageSpy = vi.spyOn(webhook, "sendMessage").mockResolvedValue();
    const req = createWhatsAppWebhookRequest("5214123456789", "1");

    await webhook.handleWebhookPost(req, webhook.sendMessage);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(webhook.sessions.has("524123456789")).toBe(true);
  });
});
