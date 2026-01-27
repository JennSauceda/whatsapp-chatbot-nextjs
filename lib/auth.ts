import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";
type TokenPayload = {
  adminId: string;
};
export function verifyAdminToken(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!)as TokenPayload;
  } catch {
    return null;
  }
}
export async function verifyAdmin() {
  try {
    // 1️⃣ Obtener token desde cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token")?.value;

    if (!token) return null;

    // 2️⃣ Verificar token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as TokenPayload;

    // 3️⃣ Verificar admin en BD
    await connectDB();
    const admin = await Admin.findById(decoded.adminId).lean();

    if (!admin) return null;

    return admin;
  } catch (error) {
    return null;
  }
}
