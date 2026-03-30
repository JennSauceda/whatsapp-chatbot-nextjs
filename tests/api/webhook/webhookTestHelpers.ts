import { vi } from "vitest";
import * as webhookService from "../../../app/api/webhook/webhookService";

vi.mock("@/lib/mongodb", () => ({
  connectDB: vi.fn(),
}));

vi.mock("@/models/User", () => ({
  default: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock("@/models/Appointment", () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock("@/lib/users", () => ({
  findOrCreateUser: vi.fn(),
}));

vi.mock("@/lib/validators", () => ({
  isValidDate: vi.fn((value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)),
  isValidEmail: vi.fn((value: string) => /\S+@\S+\.\S+/.test(value)),
}));

export const webhook = webhookService;

export function createRequest(url: string, body?: unknown) {
  return new Request(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as Request;
}

export function createVerificationRequest(token: string, challenge: string) {
  return createRequest(
    `https://example.com/api/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=${challenge}`,
  );
}

export function createWhatsAppWebhookRequest(from: string, text: string) {
  const body = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from,
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  return createRequest("https://example.com/api/webhook", body);
}

export function resetWebhookEnvironment() {
  webhook.sessions.clear();
  vi.clearAllMocks();
}

export function restoreWebhookEnvironment() {
  vi.restoreAllMocks();
}

export async function mockConnectDB() {
  const { connectDB } = await import("@/lib/mongodb");
  return connectDB as unknown as ReturnType<typeof vi.fn>;
}

export async function mockUserFindOne(result: unknown) {
  const { default: User } = await import("@/models/User");
  (User as any).findOne.mockResolvedValue(result);
  return User as any;
}

export async function mockAppointmentFindOne(result: unknown) {
  const { default: Appointment } = await import("@/models/Appointment");
  (Appointment as any).findOne.mockResolvedValue(result);
  return Appointment as any;
}

export async function mockAppointmentFind(result: unknown) {
  const { default: Appointment } = await import("@/models/Appointment");
  (Appointment as any).find.mockResolvedValue(result);
  return Appointment as any;
}

export async function mockAppointmentCreate(result: unknown) {
  const { default: Appointment } = await import("@/models/Appointment");
  (Appointment as any).create.mockResolvedValue(result);
  return Appointment as any;
}

export async function mockAppointmentDelete(result: unknown) {
  const { default: Appointment } = await import("@/models/Appointment");
  (Appointment as any).findByIdAndDelete.mockResolvedValue(result);
  return Appointment as any;
}

export async function mockUserUpdateOne(result: unknown) {
  const { default: User } = await import("@/models/User");
  (User as any).updateOne.mockResolvedValue(result);
  return User as any;
}

export async function mockFindOrCreateUser(result: unknown) {
  const { findOrCreateUser } = await import("@/lib/users");
  (findOrCreateUser as any).mockResolvedValue(result);
  return findOrCreateUser as any;
}
