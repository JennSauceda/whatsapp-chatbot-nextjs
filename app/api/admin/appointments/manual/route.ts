import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import User from "@/models/User";
import { findOrCreateUser } from "@/lib/users";
import { verifyAdmin } from "@/lib/auth";
import { BASE_HOURS } from "@/lib/availableHours";
import BlockedDate from "@/models/BlockedDate";

export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await connectDB();

    const { whatsapp, name, email, date, time } = await req.json();

    if (!whatsapp || !name || !date || !time) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    if (!whatsapp.startsWith("52")) {
      return NextResponse.json(
        { error: "WhatsApp inválido debe de inciar con 52" },
        { status: 400 },
      );
    }
    if (!BASE_HOURS.includes(time)) {
      return NextResponse.json({ error: "Hora no válida" }, { status: 400 });
    }

    console.log(whatsapp);
    //  Crear usuario si no existe
    let user = await User.findOne({ whatsapp });

    if (!user) {
      try {
        user = await findOrCreateUser({
          whatsapp,
          name,
          email,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          // El usuario ya existe, intentar encontrarlo de nuevo
          user = await User.findOne({ whatsapp });
          if (!user) {
            // Si sigue sin encontrarse, limpiar y crear de nuevo
            user = await findOrCreateUser({
              whatsapp,
              name,
              email,
            });
          }
        } else {
          throw err;
        }
      }
    }

    //  Validar cita existente
    const existing = await Appointment.findOne({
      userWhatsapp: whatsapp,
    });

    if (existing) {
      return NextResponse.json(
        { error: "El usuario ya tiene una cita activa" },
        { status: 400 },
      );
    }

    //  Validar horario ocupado
    const conflict = await Appointment.findOne({ date, time });
    if (conflict) {
      return NextResponse.json(
        { error: "Horario ya ocupado" },
        { status: 409 },
      );
    }
    const blocked = await BlockedDate.findOne({ date });

    if (blocked) {
      return NextResponse.json(
        { error: "Este día está bloqueado" },
        { status: 400 },
      );
    }

    //  Crear cita
    await Appointment.create({
      userWhatsapp: whatsapp,
      date,
      time,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Create appointment error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor: " + error },
      { status: 500 },
    );
  }
}
