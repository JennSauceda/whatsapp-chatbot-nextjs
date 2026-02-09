import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";
type TokenPayload = {
  id: string;
  role: string;
};

export function verifyAdminToken(token: string) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
  } catch {
    return null;
  }
}
export async function verifyAdmin() {
  try {
    //  Obtener token desde cookies
    const cookieStore = await cookies();
    const token = cookieStore.get("admin-token")?.value;

    if (!token) {
      console.log("No token found");
      return null;
    }

    //  Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;

    //  Verificar admin en BD
    await connectDB();
    const admin = await Admin.findById(decoded.id).lean();

    if (!admin) {
      console.log("Admin not found");
      return null;
    }

    return admin;
  } catch (error) {
    console.error("Error verifying admin:", error);
    return null;
  }
}
