import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import User from "@/models/User";
import { verifyAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await connectDB();

  const appointments = await Appointment.find()
    .sort({ date: 1, time: 1 })
    .lean();

  // Traer datos del usuario
  const enriched = await Promise.all(
    appointments.map(async (a) => {
      const user = await User.findOne({ whatsapp: a.userWhatsapp }).lean();
      return {
        _id: a._id,
        date: a.date,
        time: a.time,
        whatsapp: a.userWhatsapp,
        name: user?.name || "—",
        email: user?.email || "—",
      };
    }),
  );

  return NextResponse.json(enriched);
}
