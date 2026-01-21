import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import { sendMessage } from "@/lib/whatsapp";

export async function GET() {
  await connectDB();

  // 📅 fecha de mañana
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const date = tomorrow.toISOString().split("T")[0];

  // 🔍 buscar citas
  const appointments = await Appointment.find({ date });

  for (const appt of appointments) {
    await sendMessage(
      appt.userWhatsapp,
      `⏰ *Recordatorio de cita*

📅 Fecha: ${appt.date}
⏰ Hora: ${appt.time}

Si no puedes asistir, escribe *cancelar*.`,
    );
  }

  return NextResponse.json({
    ok: true,
    sent: appointments.length,
  });
}
