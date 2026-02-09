import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import { verifyAdmin } from "@/lib/auth";
import { BASE_HOURS } from "@/lib/availableHours";

export async function GET(req: Request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { error: "Fecha requerida" },
      { status: 400 }
    );
  }

  await connectDB();

  const appointments = await Appointment.find({ date });
  const occupied = appointments.map((a) => a.time);

  const available = BASE_HOURS.filter(
    (hour) => !occupied.includes(hour)
  );

  return NextResponse.json({ available });
}
