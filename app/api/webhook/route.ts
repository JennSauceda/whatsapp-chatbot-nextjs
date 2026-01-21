import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Appointment from "@/models/Appointment";
import { isValidDate } from "@/lib/validators";
import { isValidTime } from "@/lib/validators";
import { BASE_HOURS } from "@/lib/availableHours";

type Session = {
  step: string;
  name?: string;
  email?: string;
  date?: string;
  time?: string;
  available?: string[];
  selectedTime?: string;
  cancelAppointmentId?: string;
};

const sessions = new Map<string, Session>();

/* =========================
   VERIFICACIÓN DEL WEBHOOK
========================= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  console.log(req);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}
console.log("servidor listo");
/* =========================
   POST SIMPLE (PASO 5.2)
========================= */
export async function POST(req: NextRequest) {
  await connectDB();

  console.log("WEBHOOK HIT");

  const body = await req.json();

  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  // Si no es un mensaje (por ejemplo status), salimos

  if (!message) {
    return NextResponse.json({ ok: true });
  }
  let from = message.from;
  let session = sessions.get(from);
  if (!session) {
    session = { step: "MENU" };
    sessions.set(from, session);
  }

  const text = message.text?.body?.toLowerCase();

  if (text === "menu") {
    session.step = "MENU";
  }

  // Remove extra 1 after country code 52 if present (e.g., 5214646540222 -> 524646540222)
  if (from.startsWith("5214")) {
    from = "52" + from.substring(3);
  }

  let reply = "";

  if (session.step === "MENU") {
    reply = await buildMenu(from);
    session.step = "AWAITING_MENU";
  } else if (session.step === "AWAITING_MENU") {
    reply = await accionesMenu(from, text, session);
  } else if (session.step === "EDIT_INFO") {
    reply = await accionesEditarInfo(text, session);
  } else if (session.step === "EDIT_EMAIL") {
    reply = await editarCorreo(from, text, session);
  } else if (session.step === "EDIT_NAME") {
    reply = await editarNombre(from, text, session);
  } else if (text === "cancelar") {
    session.step = "DONE";
    reply = "❌ Acción cancelada.\n\nEscribe *menu* para comenzar de nuevo.";
  } else if (session.step === "REGISTER_NAME") {
    reply = await registroNombre(from, text, session);
  } else if (session.step === "REGISTER_EMAIL") {
    reply = await registroCorreo(from, text, session);
  } else if (session.step === "APPOINTMENT_DATE") {
    reply = await fechaCita(from, text, session);
  } else if (session.step === "APPOINTMENT_TIME") {
    reply = await horaCita(from, text, session);
  } else if (session.step === "CONFIRM_APPOINTMENT") {
    reply = await confirmarCita(from, text, session);
  } else if (session.step === "CONFIRM_CANCEL") {
    reply = await confirmarCancelacionCita(from, text, session);
  } else if (session.step === "DONE") {
    reply = "👋 ¡Hola!\n\n" + "Si deseas otra opción escribe *menu*";
  }

  await sendMessage(from, reply);

  return NextResponse.json({ ok: true });
}
async function buildMenu(from: string) {
  const user = await User.findOne({ whatsapp: from });
  const appointment = await Appointment.findOne({ userWhatsapp: from });

  let menu = "👋 *Menú principal*\n\n";

  if (!user) {
    menu += "1️⃣ Registrarme\n";
  } else {
    menu += "1️⃣ Editar mi información ✏️\n";
  }

  if (user) {
    menu += "2️⃣ Agendar cita\n";
  }

  if (appointment) {
    menu += "3️⃣ Ver mi cita\n";
    menu += "4️⃣ Cancelar mi cita\n";
  }

  menu += "\nEscribe el número de la opción";

  return menu;
}

async function accionesMenu(from: string, text: string, session: Session) {
  const user = await User.findOne({ whatsapp: from });
  const appointment = await Appointment.findOne({ userWhatsapp: from });

  let reply = "accion no valida";
  if (!user && text === "1") {
    session.step = "REGISTER_NAME";
    reply = "📛 ¿Cuál es tu nombre?";
  } else if (user && text === "1") {
    session.step = "EDIT_INFO";

    reply = "1️⃣ Editar mi nombre ✏️\n";
    reply += "2️⃣ Editar correo ✏️";
  } else if (user && text === "2") {
    session.step = "APPOINTMENT_DATE";
    reply = "📅 ¿Qué fecha deseas? (YYYY-MM-DD)";
  } else if (appointment && text === "3") {
    reply = `📋 Tu cita\n\n 📅 ${appointment.date}\n⏰ ${appointment.time}`;
  } else if (appointment && text === "4") {
    session.cancelAppointmentId = appointment._id.toString();
    session.step = "CONFIRM_CANCEL";
    reply = "⚠️ ¿Confirmas cancelar?\n1️⃣ Sí\n2️⃣ No";
  } else {
    reply = "❌ Opción inválida";
  }
  return reply;
}
async function accionesEditarInfo(text: string, session: Session) {
  let reply = "accion no valida";

  if (text === "1") {
    session.step = "EDIT_NAME";
    reply = "Introduce nuevo nombre";
  } else if (text === "2") {
    session.step = "EDIT_EMAIL";
    reply = "Introduce nuevo correo";
  } else {
    reply = "❌ Opción inválida";
  }
  return reply;
}
async function editarNombre(from: string, text: string, session: Session) {
  let reply = "accion no valida";

  await User.updateOne({ whatsapp: from }, { name: text });

  reply = "✅ Nombre actualizado\n\n ";
  reply += await buildMenu(from);
  session.step = "AWAITING_MENU";
  return reply;
}
async function editarCorreo(from: string, text: string, session: Session) {
  let reply = "accion no valida";

  await User.updateOne({ whatsapp: from }, { email: text });

  reply = "✅ Correo actualizado\n\n ";
  reply += await buildMenu(from);
  session.step = "AWAITING_MENU";
  return reply;
}
async function registroNombre(from: string, text: string, session: Session) {
  let reply = "accion no valida";

  session.name = text;
  reply =
    "📧 ¿Cuál es tu correo?\n\n" + "✳️ Escribe *menu* para volver al menú";
  session.step = "REGISTER_EMAIL";
  return reply;
}
async function registroCorreo(from: string, text: string, session: Session) {
  let reply = "accion no valida";
  session.email = text;

  const existingUser = await User.findOne({
    whatsapp: from,
  });

  if (existingUser) {
    reply = "⚠️ Ya estás registrado con este número.";
  } else {
    await User.create({
      whatsapp: from,
      name: session.name,
      email: session.email,
    });

    reply =
      "✅ Registro completo\n\n" +
      `Nombre: ${session.name}\n` +
      `Correo: ${session.email}\n\n` +
      "Gracias 🙌";
  }

  session.step = "DONE";

  return reply;
}
async function fechaCita(from: string, text: string, session: Session) {
  let reply = "accion no valida";
  if (!isValidDate(text)) {
    reply =
      "❌ Fecha inválida.\n\n" +
      "Usa el formato *YYYY-MM-DD*\n" +
      "Ejemplo: 2026-01-20\n\n" +
      "O escribe *cancelar*";
    console.log("Fecha inválida recibida:", text);
    return reply;
  }

  session.date = text;
  session.step = "APPOINTMENT_TIME";

  const appointments = await Appointment.find({ date: session.date });
  const occupied = appointments.map((a) => a.time);
  const available = BASE_HOURS.filter((hour) => !occupied.includes(hour));

  if (available.length === 0) {
    reply = `❌ No hay horarios disponibles para esta fecha.

Escribe *menu* para volver al menú`;

    return reply;
  }

  reply = `⏰ Horarios disponibles para ${session.date}\n\n`;

  available.forEach((hour, index) => {
    reply += `${index + 1}️⃣ ${hour}\n`;
  });

  reply += `\nResponde con el número del horario\nEscribe *menu* para cancelar`;

  session.available = available;

  return reply;
}
async function horaCita(from: string, text: string, session: Session) {
  let reply = "accion no valida";
  const option = parseInt(text);

  if (
    isNaN(option) ||
    option < 1 ||
    option > (session.available?.length || 0)
  ) {
    reply = "❌ Opción inválida. Elige un número válido.";
    return reply;
  }

  const selectedTime = session.available![option - 1];
  session.time = selectedTime;
  session.selectedTime = selectedTime;
  session.step = "CONFIRM_APPOINTMENT";

  reply = `📋 *Resumen de tu cita*

📅 Fecha: ${session.date}
⏰ Hora: ${session.selectedTime}

1️⃣ Confirmar
2️⃣ Cancelar`;

  return reply;
}
async function confirmarCita(from: string, text: string, session: Session) {
  let reply = "accion no valida";
  if (text === "1") {
    try {
      await Appointment.create({
        userWhatsapp: from,
        date: session.date,
        time: session.selectedTime,
      });

      reply = `✅ *Cita confirmada*

📅 ${session.date}
⏰ ${session.selectedTime}

Gracias 🙌`;
    } catch (error: any) {
      if (error.code === 11000) {
        reply = `❌ Ese horario ya fue ocupado.
Intenta con otro horario.`;
      } else {
        reply = `⚠️ Ocurrió un error al guardar tu cita`;
      }
    }

    session.step = "DONE";
    return reply;
  }

  if (text === "2") {
    session.step = "DONE";
    reply = `❌ Cita cancelada.
Escribe *menu* para volver al inicio.`;
    return reply;
  }

  reply = "❌ Opción inválida. Responde 1 o 2.";
  return reply;
}
async function confirmarCancelacionCita(
  from: string,
  text: string,
  session: Session,
) {
  let reply = "accion no valida";
  if (text === "1") {
    await Appointment.findByIdAndDelete(session.cancelAppointmentId);

    reply = "✅ Tu cita ha sido cancelada.";

    session.step = "DONE";
    return reply;
  }

  if (text === "2") {
    session.step = "DONE";
    reply = "Volviendo al menú…";
    return reply;
  }

  reply = "❌ Opción inválida. Responde 1 o 2.";
  return reply;
}

/* =========================
   FUNCIÓN PARA ENVIAR MENSAJES
========================= */
async function sendMessage(telephone: string, bodyText: string) {
  const res = await fetch(
    `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telephone,
        type: "text",
        text: {
          preview_url: false,
          body: bodyText,
        },
      }),
    },
  );

  const data = await res.json();
  console.log("WHATSAPP RESPONSE:", data);
}
