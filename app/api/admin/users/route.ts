import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Appointment from "@/models/Appointment";
import { verifyAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await connectDB();

  const users = await User.find()
    .sort({ createdAt: -1 })
    .lean();

  // Agregamos total de citas por usuario
  const usersWithStats = await Promise.all(
    users.map(async (user) => {
      const totalAppointments = await Appointment.countDocuments({
        userWhatsapp: user.whatsapp,
      });

      return {
        ...user,
        totalAppointments,
      };
    })
  );

  return NextResponse.json(usersWithStats);
}
