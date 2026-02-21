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

  const today = new Date().toISOString().split("T")[0];

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const totalUsers = await User.countDocuments();
  const totalAppointments = await Appointment.countDocuments();
  const todayAppointments = await Appointment.countDocuments({ date: today });

  const weekAppointments = await Appointment.countDocuments({
    date: { $gte: weekStartStr },
  });

  const nextAppointment = await Appointment.findOne({
    date: { $gte: today },
  })
    .sort({ date: 1, time: 1 })
    .lean();

  // Horas más usadas
  const topHours = await Appointment.aggregate([
    { $group: { _id: "$time", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 3 },
  ]);

  // Citas últimos 7 días
  const last7Days = new Date();
  last7Days.setDate(now.getDate() - 6);
  const last7DaysStr = last7Days.toISOString().split("T")[0];

  const perDay = await Appointment.aggregate([
    { $match: { date: { $gte: last7DaysStr } } },
    { $group: { _id: "$date", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return NextResponse.json({
    totalUsers,
    totalAppointments,
    todayAppointments,
    weekAppointments,
    nextAppointment,
    topHours,
    perDay,
  });
}
