import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockConnectDB = vi.fn();
const mockVerifyAdmin = vi.fn();

const mockUser = {
  find: vi.fn(),
  findById: vi.fn(),
  findByIdAndDelete: vi.fn(),
};

const mockAppointment = {
  countDocuments: vi.fn(),
  find: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("@/lib/mongodb", () => ({
  connectDB: mockConnectDB,
}));

vi.mock("@/lib/auth", () => ({
  verifyAdmin: mockVerifyAdmin,
}));

vi.mock("@/models/User", () => ({
  default: mockUser,
}));

vi.mock("@/models/Appointment", () => ({
  default: mockAppointment,
}));

function createJsonRequest(body?: unknown, method = "GET") {
  return new Request("https://example.com/api/admin/users", {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockUserFindChain(result: unknown) {
  mockUser.find.mockReturnValue({
    sort: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(result),
    })),
  });
}

function mockUserFindByIdChain(result: unknown) {
  mockUser.findById.mockReturnValue({
    lean: vi.fn().mockResolvedValue(result),
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

let usersRoute: typeof import("@/app/api/admin/users/route");
let usersIdRoute: typeof import("@/app/api/admin/users/[id]/route");

beforeAll(async () => {
  usersRoute = await import("@/app/api/admin/users/route");
  usersIdRoute = await import("@/app/api/admin/users/[id]/route");
});

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyAdmin.mockResolvedValue(true);
  mockConnectDB.mockResolvedValue(undefined);
});

describe("Admin users CRUD", () => {
  describe("GET /api/admin/users", () => {
    it("devuelve 401 cuando el admin no está autorizado", async () => {
      mockVerifyAdmin.mockResolvedValue(null);

      const response = await usersRoute.GET();
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "No autorizado" });
      expect(mockConnectDB).not.toHaveBeenCalled();
    });

    it("devuelve lista de usuarios vacía cuando no hay usuarios", async () => {
      mockUserFindChain([]);
      mockAppointment.countDocuments.mockResolvedValue(0);

      const response = await usersRoute.GET();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
      expect(mockConnectDB).toHaveBeenCalledOnce();
      expect(mockUser.find).toHaveBeenCalledOnce();
    });

    it("devuelve usuarios con estadísticas de citas", async () => {
      mockUserFindChain([
        {
          _id: "user1",
          whatsapp: "521234567890",
          name: "Juan",
          email: "juan@test.com",
        },
        {
          _id: "user2",
          whatsapp: "521987654321",
          name: "María",
          email: "maria@test.com",
        },
      ]);
      mockAppointment.countDocuments
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(3);

      const response = await usersRoute.GET();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveLength(2);
      expect(data[0]).toEqual({
        _id: "user1",
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
        totalAppointments: 1,
      });
      expect(data[1]).toEqual({
        _id: "user2",
        whatsapp: "521987654321",
        name: "María",
        email: "maria@test.com",
        totalAppointments: 3,
      });
      expect(mockAppointment.countDocuments).toHaveBeenCalledTimes(2);
    });
  });

  describe("GET /api/admin/users/[id]", () => {
    it("devuelve 401 cuando el admin no está autorizado", async () => {
      mockVerifyAdmin.mockResolvedValue(null);
      const req = createJsonRequest();

      const response = await usersIdRoute.GET(req, makeContext("user1"));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "No autorizado" });
    });

    it("devuelve 404 cuando el usuario no existe", async () => {
      mockUserFindByIdChain(null);
      const req = createJsonRequest();

      const response = await usersIdRoute.GET(req, makeContext("user1"));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "No encontrado" });
    });

    it("devuelve usuario con sus citas", async () => {
      mockUserFindByIdChain({
        _id: "user1",
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
      });
      mockAppointmentFindChain([
        {
          _id: "appo1",
          date: "2026-05-01",
          time: "09:00",
          userWhatsapp: "521234567890",
        },
        {
          _id: "appo2",
          date: "2026-04-25",
          time: "14:00",
          userWhatsapp: "521234567890",
        },
      ]);
      const req = createJsonRequest();

      const response = await usersIdRoute.GET(req, makeContext("user1"));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        user: {
          _id: "user1",
          whatsapp: "521234567890",
          name: "Juan",
          email: "juan@test.com",
        },
        appointments: [
          {
            _id: "appo1",
            date: "2026-05-01",
            time: "09:00",
            userWhatsapp: "521234567890",
          },
          {
            _id: "appo2",
            date: "2026-04-25",
            time: "14:00",
            userWhatsapp: "521234567890",
          },
        ],
      });
      expect(mockUser.findById).toHaveBeenCalledWith("user1");
      expect(mockAppointment.find).toHaveBeenCalledWith({
        userWhatsapp: "521234567890",
      });
    });

    it("devuelve usuario con citas vacías", async () => {
      mockUserFindByIdChain({
        _id: "user1",
        whatsapp: "521234567890",
        name: "Juan",
        email: "juan@test.com",
      });
      mockAppointmentFindChain([]);
      const req = createJsonRequest();

      const response = await usersIdRoute.GET(req, makeContext("user1"));
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.appointments).toEqual([]);
    });
  });

  describe("DELETE /api/admin/users/[id]", () => {
    it("devuelve 401 cuando el admin no está autorizado", async () => {
      mockVerifyAdmin.mockResolvedValue(null);
      const req = createJsonRequest(undefined, "DELETE");

      const response = await usersIdRoute.DELETE(req, makeContext("user1"));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "No autorizado" });
    });

    it("devuelve 404 cuando el usuario no existe", async () => {
      mockUser.findById.mockResolvedValue(null);
      const req = createJsonRequest(undefined, "DELETE");

      const response = await usersIdRoute.DELETE(req, makeContext("user1"));
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "No encontrado" });
    });

    it("elimina usuario y todas sus citas", async () => {
      mockUser.findById.mockResolvedValue({
        _id: "user1",
        whatsapp: "521234567890",
        name: "Juan",
      });
      mockAppointment.deleteMany.mockResolvedValue({ deletedCount: 2 });
      mockUser.findByIdAndDelete.mockResolvedValue({ _id: "user1" });
      const req = createJsonRequest(undefined, "DELETE");

      const response = await usersIdRoute.DELETE(req, makeContext("user1"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockAppointment.deleteMany).toHaveBeenCalledWith({
        userWhatsapp: "521234567890",
      });
      expect(mockUser.findByIdAndDelete).toHaveBeenCalledWith("user1");
    });

    it("elimina usuario aunque no tenga citas", async () => {
      mockUser.findById.mockResolvedValue({
        _id: "user1",
        whatsapp: "521234567890",
        name: "Juan",
      });
      mockAppointment.deleteMany.mockResolvedValue({ deletedCount: 0 });
      mockUser.findByIdAndDelete.mockResolvedValue({ _id: "user1" });
      const req = createJsonRequest(undefined, "DELETE");

      const response = await usersIdRoute.DELETE(req, makeContext("user1"));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect(mockAppointment.deleteMany).toHaveBeenCalledOnce();
      expect(mockUser.findByIdAndDelete).toHaveBeenCalledOnce();
    });
  });
});
