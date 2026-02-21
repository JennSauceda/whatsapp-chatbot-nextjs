import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
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

  const total = await Appointment.countDocuments();
  const todayCount = await Appointment.countDocuments({ date: today });

  const weekCount = await Appointment.countDocuments({
    date: { $gte: weekStartStr },
  });

  // Horas más usadas
  const hoursAggregation = await Appointment.aggregate([
    {
      $group: {
        _id: "$time",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);

  // Ocupación por día
  const perDay = await Appointment.aggregate([
    {
      $group: {
        _id: "$date",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return NextResponse.json({
    total,
    today: todayCount,
    week: weekCount,
    hours: hoursAggregation,
    perDay,
  });
}
