import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockConnectDB = vi.fn();
const mockVerifyAdmin = vi.fn();
const mockSendMessage = vi.fn();
const mockFindOrCreateUser = vi.fn();

const mockAppointment = {
  find: vi.fn(),
  findByIdAndDelete: vi.fn(),
  findOne: vi.fn(),
  findByIdAndUpdate: vi.fn(),
  create: vi.fn(),
};

const mockUser = {
  findOne: vi.fn(),
};

const mockBlockedDate = {
  findOne: vi.fn(),
};

vi.mock("@/lib/mongodb", () => ({
  connectDB: mockConnectDB,
}));

vi.mock("@/lib/auth", () => ({
  verifyAdmin: mockVerifyAdmin,
}));

vi.mock("@/models/Appointment", () => ({
  default: mockAppointment,
}));

vi.mock("@/models/User", () => ({
  default: mockUser,
}));

vi.mock("@/models/BlockedDate", () => ({
  default: mockBlockedDate,
}));

vi.mock("@/lib/users", () => ({
  findOrCreateUser: mockFindOrCreateUser,
}));

vi.mock("@/lib/whatsapp", () => ({
  sendMessage: mockSendMessage,
}));

vi.mock("@/lib/availableHours", () => ({
  BASE_HOURS: [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
    "17:00",
  ],
}));

function createJsonRequest(body?: unknown, method = "POST") {
  return new Request("https://example.com/api/admin/appointments", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockAppointmentFindChain(result: unknown) {
  mockAppointment.find.mockReturnValue({
    sort: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(result),
    })),
  });
}

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

let appRoute: typeof import("@/app/api/admin/appointments/route");
let appIdRoute: typeof import("@/app/api/admin/appointments/[id]/route");
let manualRoute: typeof import("@/app/api/admin/appointments/manual/route");

beforeAll(async () => {
  appRoute = await import("@/app/api/admin/appointments/route");
  appIdRoute = await import("@/app/api/admin/appointments/[id]/route");
  manualRoute = await import("@/app/api/admin/appointments/manual/route");
});

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue(true);
  mockConnectDB.mockResolvedValue(undefined);
});

describe("Admin appointments CRUD", () => {
  describe("GET /api/admin/appointments", () => {
    it("returns 401 cuando el admin no está autorizado", async () => {
      mockVerifyAdmin.mockResolvedValue(null);

      const response = await appRoute.GET();
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual([]);
      expect(mockConnectDB).not.toHaveBeenCalled();
    });

    it("devuelve citas enriquecidas correctamente", async () => {
      mockAppointmentFindChain([
        {
          _id: "1",
          date: "2026-05-01",
          time: "09:00",
          userWhatsapp: "521234567890",
        },
      ]);
      mockUser.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue({ name: "Juan", email: "juan@test.com" }),
      });

      const response = await appRoute.GET();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([
        {
          _id: "1",
          date: "2026-05-01",
          time: "09:00",
          whatsapp: "521234567890",
          name: "Juan",
          email: "juan@test.com",
        },
      ]);
      expect(mockConnectDB).toHaveBeenCalledOnce();
      expect(mockAppointment.find).toHaveBeenCalledOnce();
      expect(mockUser.findOne).toHaveBeenCalledOnce();
    });
  });

  describe("DELETE /api/admin/appointments/[id]", () => {
    it("devuelve 401 cuando no hay admin", async () => {
      mockVerifyAdmin.mockResolvedValue(null);
      const req = createJsonRequest(undefined, "DELETE");

      const response = await appIdRoute.DELETE(req, makeContext("123"));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "No autorizado" });
    });

    it("elimina una cita y devuelve éxito", async () => {
      mockAppointment.findByIdAndDelete.mockResolvedValue(true);
      const req = createJsonRequest(undefined, "DELETE");

      const response = await appIdRoute.DELETE(req, makeContext("123"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockAppointment.findByIdAndDelete).toHaveBeenCalledWith("123");
      expect(mockConnectDB).toHaveBeenCalledOnce();
    });
  });

  describe("PATCH /api/admin/appointments/[id]", () => {
    it("devuelve 401 cuando no hay admin", async () => {
      mockVerifyAdmin.mockResolvedValue(null);
      const req = createJsonRequest({ date: "2026-05-02", time: "10:00" }, "PATCH");

      const response = await appIdRoute.PATCH(req, makeContext("123"));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "No autorizado" });
    });

    it("devuelve 400 cuando falta fecha u hora", async () => {
      const req = createJsonRequest({ date: "", time: "" }, "PATCH");

      const response = await appIdRoute.PATCH(req, makeContext("123"));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Fecha y hora requeridas" });
    });

    it("devuelve 409 cuando el horario ya está ocupado", async () => {
      mockAppointment.findOne.mockResolvedValue({ _id: { toString: () => "456" } });
      const req = createJsonRequest({ date: "2026-05-02", time: "10:00" }, "PATCH");

      const response = await appIdRoute.PATCH(req, makeContext("123"));
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "Horario ya ocupado" });
    });

    it("actualiza una cita y envía un mensaje al usuario", async () => {
      mockAppointment.findOne.mockResolvedValue(null);
      mockAppointment.findByIdAndUpdate.mockResolvedValue({ userWhatsapp: "521234567890" });
      const req = createJsonRequest({ date: "2026-05-02", time: "10:00" }, "PATCH");

      const response = await appIdRoute.PATCH(req, makeContext("123"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockAppointment.findByIdAndUpdate).toHaveBeenCalledWith("123", {
        date: "2026-05-02",
        time: "10:00",
      });
      expect(mockSendMessage).toHaveBeenCalledWith(
        "521234567890",
        expect.stringContaining("Tu cita ha sido reprogramada"),
      );
    });
  });

  describe("POST /api/admin/appointments/manual", () => {
    it("devuelve 401 cuando el admin no está autorizado", async () => {
      mockVerifyAdmin.mockResolvedValue(null);
      const request = createJsonRequest({
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
        date: "2026-05-01",
        time: "09:00",
      });

      const response = await manualRoute.POST(request);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "No autorizado" });
    });

    it("valida datos incompletos", async () => {
      const request = createJsonRequest({ whatsapp: "521234567890", name: "Juan" });

      const response = await manualRoute.POST(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Datos incompletos" });
    });

    it("valida el prefijo de WhatsApp", async () => {
      const request = createJsonRequest({
        whatsapp: "441234567890",
        name: "Juan",
        email: "juan@test.com",
        date: "2026-05-01",
        time: "09:00",
      });

      const response = await manualRoute.POST(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "WhatsApp inválido debe de inciar con 52" });
    });

    it("valida hora no válida", async () => {
      const request = createJsonRequest({
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
        date: "2026-05-01",
        time: "20:00",
      });

      const response = await manualRoute.POST(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Hora no válida" });
    });

    it("no permite crear una cita si el usuario ya tiene una cita activa", async () => {
      mockUser.findOne.mockResolvedValue({ _id: "u1" });
      mockAppointment.findOne.mockResolvedValueOnce({ userWhatsapp: "521234567890" });
      const request = createJsonRequest({
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
        date: "2026-05-01",
        time: "09:00",
      });

      const response = await manualRoute.POST(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "El usuario ya tiene una cita activa" });
    });

    it("no permite crear una cita si el horario ya está ocupado", async () => {
      mockUser.findOne.mockResolvedValue({ _id: "u1" });
      mockAppointment.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ date: "2026-05-01", time: "09:00" });
      const request = createJsonRequest({
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
        date: "2026-05-01",
        time: "09:00",
      });

      const response = await manualRoute.POST(request);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "Horario ya ocupado" });
    });

    it("no permite crear una cita en un día bloqueado", async () => {
      mockUser.findOne.mockResolvedValue({ _id: "u1" });
      mockAppointment.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockBlockedDate.findOne.mockResolvedValue({ date: "2026-05-01" });
      const request = createJsonRequest({
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
        date: "2026-05-01",
        time: "09:00",
      });

      const response = await manualRoute.POST(request);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Este día está bloqueado" });
    });

    it("crea correctamente una cita manual cuando el usuario existe", async () => {
      mockUser.findOne.mockResolvedValue({ _id: "u1" });
      mockAppointment.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      mockBlockedDate.findOne.mockResolvedValue(null);
      mockAppointment.create.mockResolvedValue({ _id: "a1" });
      const request = createJsonRequest({
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
        date: "2026-05-01",
        time: "09:00",
      });

      const response = await manualRoute.POST(request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockAppointment.create).toHaveBeenCalledWith({
        userWhatsapp: "521234567890",
        date: "2026-05-01",
        time: "09:00",
      });
    });
  });
});
