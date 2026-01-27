import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Appointment from "@/models/Appointment";
import { verifyAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await connectDB();

  const totalUsers = await User.countDocuments();
  const totalAppointments = await Appointment.countDocuments();

  const today = new Date().toISOString().split("T")[0];

  const todayAppointments = await Appointment.countDocuments({
    date: today,
  });

  const nextAppointment = await Appointment.findOne({
    date: { $gte: today },
  }).sort({ date: 1, time: 1 });

  return NextResponse.json({
    totalUsers,
    totalAppointments,
    todayAppointments,
    nextAppointment,
  });
}
