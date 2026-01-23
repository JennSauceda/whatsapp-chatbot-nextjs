import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Appointment from "@/models/Appointment";
import { isValidDate } from "@/lib/validators";
import { BASE_HOURS } from "@/lib/availableHours";
import { isValidEmail } from "@/lib/validators";

type Session = {
  step: string;
  whatsapp?: string;
  name?: string;
  email?: string;
  date?: string;
  time?: string;
  available?: string[];
  selectedTime?: string;
  cancelAppointmentId?: string;
  segundoMensaje?: string;
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
  // Remove extra 1 after country code 52 if present (e.g., 5214646540222 -> 524646540222)
  if (from.startsWith("5214")) {
    from = "52" + from.substring(3);
  }

  const text = message.text?.body?.toLowerCase();

  let session = sessions.get(from);
  if (!session) {
    session = { step: "MENU", whatsapp: from };
    sessions.set(from, session);
    // Buscar usuario en DB
    const user = await User.findOne({ whatsapp: from });

    // Si es usuario nuevo y no ha iniciado sesión aún
    if (!user) {
      const welcome =
        "👋 *¡Bienvenido!*\n\n" +
        "Soy el asistente de citas 😊\n" +
        "Desde aquí puedes registrarte y luego agendar una cita.\n\n" +
        (await buildMenu(from));

      session.step = "AWAITING_MENU";
      await sendMessage(from, welcome);
      return NextResponse.json({ ok: true });
    }
  }

  if (text === "menu") {
    session.step = "MENU";
  }

  if (text === "cancelar") {
    session.step = "DONE";
    await sendMessage(from, "❌ Acción cancelada.\n\nEscribe *menu*");
    return NextResponse.json({ ok: true });
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
  if (session.segundoMensaje !== undefined) {
    await sendMessage(from, session.segundoMensaje);
    delete session.segundoMensaje;
  }

  return NextResponse.json({ ok: true });
}
async function buildMenu(from: string) {
  const user = await User.findOne({ whatsapp: from });
  const appointment = await Appointment.findOne({ userWhatsapp: from });

  let menu = "👋 *Menú principal*\n\n";

  if (!user) {
    menu += "1️⃣ Registrarme\n";
  } else {
    menu += "1️⃣ Editar o ver mi información ✏️\n";
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

  let reply = "❌ Opción inválida. Escribe *menu*";
  if (!user && text === "1") {
    session.step = "REGISTER_NAME";
    reply = "🧸 ¿Cuál es tu nombre?";
  } else if (user && text === "1") {
    session.step = "EDIT_INFO";

    reply = "1️⃣ Editar mi nombre ✏️\n";
    reply += "2️⃣ Editar correo ✏️ \n";
    reply += "3️⃣ Ver mis datos 👀\n" + "Escribe el número de la opción";
  } else if (user && text === "2") {
    const existingAppointment = await Appointment.findOne({
      userWhatsapp: from,
    });

    if (existingAppointment) {
      reply = `⚠️ Ya tienes una cita agendada.

📅 ${existingAppointment.date}
⏰ ${existingAppointment.time}

Si deseas cambiarla, primero debes cancelarla (escribe *menu* y despues selecciona la opción 4️⃣).`;
      session.step = "DONE";
    } else {
      session.step = "APPOINTMENT_DATE";
      reply = "📅 ¿Qué fecha deseas? (YYYY-MM-DD)";
    }
  } else if (appointment && text === "3") {
    reply = `📋 Tu cita\n\n 📅 ${appointment.date}\n⏰ ${appointment.time}`;
    reply += regresoAMenuTexto();
  } else if (appointment && text === "4") {
    session.cancelAppointmentId = appointment._id.toString();
    session.step = "CONFIRM_CANCEL";
    reply = "⚠️ ¿Confirmas cancelar?\n1️⃣ Sí\n2️⃣ No";
  } else {
    reply = "❌ Opción inválida.Escribe *menu*";
  }
  return reply;
}
async function accionesEditarInfo(text: string, session: Session) {
  let reply = "❌ Opción inválida. Escribe *menu*";

  if (text === "1") {
    session.step = "EDIT_NAME";
    reply = "Introduce nuevo nombre";
  } else if (text === "2") {
    session.step = "EDIT_EMAIL";
    reply = "Introduce nuevo correo";
  } else if (text === "3") {
    session.step = "DONE";
    reply = await verMisDatos(session);
  } else {
    reply = "❌ Opción inválida. Escribe *menu*";
  }
  return reply;
}
async function editarNombre(from: string, text: string, session: Session) {
  let reply = "❌ Opción inválida. Escribe *menu*";

  await User.updateOne({ whatsapp: from }, { name: text });

  reply = "✅ Nombre actualizado\n\n ";
  reply += await buildMenu(from);
  session.step = "AWAITING_MENU";
  return reply;
}
async function editarCorreo(from: string, text: string, session: Session) {
  let reply = "❌ Opción inválida. Escribe *menu*";
  if (!isValidEmail(text)) {
    return textoDeCorreoNoValido();
  }

  await User.updateOne({ whatsapp: from }, { email: text });

  await User.updateOne({ whatsapp: from }, { email: text });

  reply = "✅ Correo actualizado\n\n ";
  reply += await buildMenu(from);
  session.step = "AWAITING_MENU";
  return reply;
}
async function registroNombre(from: string, text: string, session: Session) {
  let reply = "❌ Opción inválida. Escribe *menu*";

  session.name = text;
  reply = "📧 ¿Cuál es tu correo?\n\n";
  session.step = "REGISTER_EMAIL";
  return reply;
}
function textoDeCorreoNoValido() {
  return (
    "❌ Correo inválido.\n\n" +
    "Ejemplo válido:\n" +
    "correo@dominio.com\n\n" +
    "Intenta nuevamente o escribe *menu*"
  );
}
async function registroCorreo(from: string, text: string, session: Session) {
  let reply = "❌ Opción inválida. Escribe *menu*";
  if (!isValidEmail(text)) {
    return textoDeCorreoNoValido();
  }

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
    reply += await regresoAMenu(from, text, session);
    return reply;
  }

  session.step = "DONE";

  return reply;
}
async function fechaCita(from: string, text: string, session: Session) {
  let reply = "❌ Opción inválida. Escribe *menu*";
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
  let reply = "❌ Opción inválida. Escribe *menu*";
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
  let reply = "❌ Opción inválida. Escribe *menu*";
  if (text === "1") {
    try {
      const existingAppointment = await Appointment.findOne({
        userWhatsapp: from,
      });

      if (existingAppointment) {
        reply = `⚠️ Ya tienes una cita activa.

Cancélala antes de crear una nueva.`;
        session.step = "DONE";
        return reply;
      }
      await Appointment.create({
        userWhatsapp: from,
        date: session.date,
        time: session.selectedTime,
      });

      reply = `✅ *Cita confirmada*

📅 ${session.date}
⏰ ${session.selectedTime}

Gracias 🙌`;
      reply += regresoAMenuTexto();
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
  resetSession(session);

  return reply;
}
async function confirmarCancelacionCita(
  from: string,
  text: string,
  session: Session,
) {
  let reply = "❌ Opción inválida. Escribe *menu*";
  if (text === "1") {
    await Appointment.findByIdAndDelete(session.cancelAppointmentId);

    reply = "✅ Tu cita ha sido cancelada.";
    reply += regresoAMenuTexto();

    session.step = "DONE";
    resetSession(session);
    return reply;
  }

  if (text === "2") {
    session.step = "AWAITING_MENU";
    reply = "Volviendo al menú… \n\n";
    reply += await buildMenu(from);
    return reply;
  }

  reply = "❌ Opción inválida. Responde 1 o 2.";
  return reply;
}
async function regresoAMenu(from: string, text: string, session: Session) {
  let reply = "\n\n Redirigiendo al menú principal... \n\n ";
  session.step = "AWAITING_MENU";
  session.segundoMensaje = await buildMenu(from);
  return reply;
}
function regresoAMenuTexto() {
  return "\n\n Escribe *menu* si deseas otra opción.";
}
function resetSession(session: Session) {
  session.step = "MENU";
  delete session.name;
  delete session.email;
  delete session.date;
  delete session.time;
  delete session.available;
  delete session.selectedTime;
  delete session.cancelAppointmentId;
}
async function verMisDatos(session: Session) {
  const user = await User.findOne({ whatsapp: session?.whatsapp });

  if (!user) {
    return "❌ No se encontraron tus datos.\n\nEscribe *menu*";
  }

  return (
    "👤 *Mis datos*\n\n" +
    `🧸 Nombre: ${user.name}\n` +
    `📧 Correo: ${user.email}\n` +
    `📱 WhatsApp: ${user.whatsapp}\n\n` +
    "Escribe *menu* para volver"
  );
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
