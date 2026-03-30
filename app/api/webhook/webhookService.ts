import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Appointment from "@/models/Appointment";
import { isValidDate, isValidEmail } from "@/lib/validators";
import { BASE_HOURS } from "@/lib/availableHours";
import { findOrCreateUser } from "@/lib/users";

export type Session = {
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

export const sessions = new Map<string, Session>();

export async function handleWebhookGet(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function handleWebhookPost(
  req: NextRequest,
  sendMessageFn: (
    telephone: string,
    bodyText: string,
  ) => Promise<void> = sendMessage,
) {
  await connectDB();

  const body = await req.json();
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message) {
    return NextResponse.json({ ok: true });
  }

  const from = normalizeWhatsapp(message.from);
  const text = message.text?.body?.toLowerCase();

  let session = sessions.get(from);

  if (!session) {
    session = { step: "MENU", whatsapp: from };
    sessions.set(from, session);

    const user = await User.findOne({ whatsapp: from });
    if (!user) {
      const welcome =
        "👋 *¡Bienvenido!*\n\n" +
        "Soy el asistente de citas 😊\n" +
        "Desde aquí puedes registrarte y luego agendar una cita.\n\n" +
        (await buildMenu(from));

      session.step = "AWAITING_MENU";
      await sendMessageFn(from, welcome);
      return NextResponse.json({ ok: true });
    }
  }

  if (text === "menu") {
    session.step = "MENU";
  }

  if (text === "cancelar") {
    session.step = "DONE";
    await sendMessageFn(from, "❌ Acción cancelada.\n\nEscribe *menu*");
    return NextResponse.json({ ok: true });
  }

  let reply = "";

  switch (session.step) {
    case "MENU":
      reply = await buildMenu(from);
      session.step = "AWAITING_MENU";
      break;
    case "AWAITING_MENU":
      reply = await accionesMenu(from, text, session);
      break;
    case "EDIT_INFO":
      reply = await accionesEditarInfo(text, session);
      break;
    case "EDIT_EMAIL":
      reply = await editarCorreo(from, text, session);
      break;
    case "EDIT_NAME":
      reply = await editarNombre(from, text, session);
      break;
    case "REGISTER_NAME":
      reply = await registroNombre(from, text, session);
      break;
    case "REGISTER_EMAIL":
      reply = await registroCorreo(from, text, session);
      break;
    case "APPOINTMENT_DATE":
      reply = await fechaCita(from, text, session);
      break;
    case "APPOINTMENT_TIME":
      reply = await horaCita(from, text, session);
      break;
    case "CONFIRM_APPOINTMENT":
      reply = await confirmarCita(from, text, session);
      break;
    case "CONFIRM_CANCEL":
      reply = await confirmarCancelacionCita(from, text, session);
      break;
    case "DONE":
      reply = "👋 ¡Hola!\n\nSi deseas otra opción escribe *menu*";
      break;
    default:
      reply = "❌ Opción inválida. Escribe *menu*";
  }

  await sendMessageFn(from, reply);

  if (session.segundoMensaje !== undefined) {
    await sendMessageFn(from, session.segundoMensaje);
    delete session.segundoMensaje;
  }

  return NextResponse.json({ ok: true });
}

function normalizeWhatsapp(whatsapp: string) {
  if (whatsapp.startsWith("5214")) {
    return "52" + whatsapp.substring(3);
  }
  return whatsapp;
}

export async function buildMenu(from: string) {
  const user = await User.findOne({ whatsapp: from });
  const appointment = await Appointment.findOne({ userWhatsapp: from });

  let menu = "👋 *Menú principal*\n\n";
  menu += user ? "1️⃣ Editar o ver mi información ✏️\n" : "1️⃣ Registrarme\n";

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

export async function accionesMenu(
  from: string,
  text: string | undefined,
  session: Session,
) {
  const user = await User.findOne({ whatsapp: from });
  const appointment = await Appointment.findOne({ userWhatsapp: from });

  let reply = "❌ Opción inválida. Escribe *menu*";

  if (!user && text === "1") {
    session.step = "REGISTER_NAME";
    reply = "🧸 ¿Cuál es tu nombre?";
  } else if (user && text === "1") {
    session.step = "EDIT_INFO";
    reply =
      "1️⃣ Editar mi nombre ✏️\n" +
      "2️⃣ Editar correo ✏️ \n" +
      "3️⃣ Ver mis datos 👀\n" +
      "Escribe el número de la opción";
  } else if (user && text === "2") {
    const existingAppointment = await Appointment.findOne({ userWhatsapp: from });

    if (existingAppointment) {
      reply = `⚠️ Ya tienes una cita agendada.\n\n📅 ${existingAppointment.date}\n⏰ ${existingAppointment.time}\n\nSi deseas cambiarla, primero debes cancelarla (escribe *menu* y despues selecciona la opción 4️⃣).`;
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
  }

  return reply;
}

export async function accionesEditarInfo(
  text: string | undefined,
  session: Session,
) {
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
  }

  return reply;
}

export async function editarNombre(
  from: string,
  text: string | undefined,
  session: Session,
) {
  await User.updateOne({ whatsapp: from }, { name: text });

  let reply = "✅ Nombre actualizado\n\n ";
  reply += await buildMenu(from);
  session.step = "AWAITING_MENU";
  return reply;
}

export async function editarCorreo(
  from: string,
  text: string | undefined,
  session: Session,
) {
  if (!isValidEmail(text || "")) {
    return textoDeCorreoNoValido();
  }

  await User.updateOne({ whatsapp: from }, { email: text });

  let reply = "✅ Correo actualizado\n\n ";
  reply += await buildMenu(from);
  session.step = "AWAITING_MENU";
  return reply;
}

export async function registroNombre(
  from: string,
  text: string | undefined,
  session: Session,
) {
  session.name = text;
  session.step = "REGISTER_EMAIL";
  return "📧 ¿Cuál es tu correo?\n\n";
}

export function textoDeCorreoNoValido() {
  return (
    "❌ Correo inválido.\n\n" +
    "Ejemplo válido:\n" +
    "correo@dominio.com\n\n" +
    "Intenta nuevamente o escribe *menu*"
  );
}

export async function registroCorreo(
  from: string,
  text: string | undefined,
  session: Session,
) {
  if (!isValidEmail(text || "")) {
    return textoDeCorreoNoValido();
  }

  session.email = text;

  const existingUser = await User.findOne({ whatsapp: from });

  if (existingUser) {
    session.step = "DONE";
    return "⚠️ Ya estás registrado con este número.";
  }

  await findOrCreateUser({
    whatsapp: from,
    name: session.name!,
    email: session.email,
  });

  let reply =
    "✅ Registro completo\n\n" +
    `Nombre: ${session.name}\n` +
    `Correo: ${session.email}\n\n` +
    "Gracias 🙌";

  reply += await regresoAMenu(from, session);
  return reply;
}

export async function fechaCita(
  from: string,
  text: string | undefined,
  session: Session,
) {
  if (!isValidDate(text || "")) {
    return (
      "❌ Fecha inválida.\n\n" +
      "Usa el formato *YYYY-MM-DD*\n" +
      "Ejemplo: 2026-01-20\n\n" +
      "O escribe *cancelar*"
    );
  }

  session.date = text;
  session.step = "APPOINTMENT_TIME";

  const appointments = await Appointment.find({ date: session.date });
  const occupied = appointments.map((appointment) => appointment.time);
  const available = BASE_HOURS.filter((hour) => !occupied.includes(hour));

  if (available.length === 0) {
    return `❌ No hay horarios disponibles para esta fecha.\n\nEscribe *menu* para volver al menú`;
  }

  let reply = `⏰ Horarios disponibles para ${session.date}\n\n`;
  available.forEach((hour, index) => {
    reply += `${index + 1}️⃣ ${hour}\n`;
  });
  reply += `\nResponde con el número del horario\nEscribe *menu* para cancelar`;

  session.available = available;
  return reply;
}

export async function horaCita(
  from: string,
  text: string | undefined,
  session: Session,
) {
  const option = parseInt(text || "", 10);

  if (isNaN(option) || option < 1 || option > (session.available?.length || 0)) {
    return "❌ Opción inválida. Elige un número válido.";
  }

  const selectedTime = session.available![option - 1];
  session.time = selectedTime;
  session.selectedTime = selectedTime;
  session.step = "CONFIRM_APPOINTMENT";

  return `📋 *Resumen de tu cita*\n\n📅 Fecha: ${session.date}\n⏰ Hora: ${session.selectedTime}\n\n1️⃣ Confirmar\n2️⃣ Cancelar`;
}

export async function confirmarCita(
  from: string,
  text: string | undefined,
  session: Session,
) {
  if (text === "1") {
    try {
      const existingAppointment = await Appointment.findOne({ userWhatsapp: from });
      if (existingAppointment) {
        session.step = "DONE";
        return `⚠️ Ya tienes una cita activa.\n\nCancélala antes de crear una nueva.`;
      }

      await Appointment.create({
        userWhatsapp: from,
        date: session.date,
        time: session.selectedTime,
      });

      let reply = `✅ *Cita confirmada*\n\n📅 ${session.date}\n⏰ ${session.selectedTime}\n\nGracias 🙌`;
      reply += regresoAMenuTexto();
      session.step = "DONE";
      return reply;
    } catch (error: any) {
      if (error.code === 11000) {
        return `❌ Ese horario ya fue ocupado.\nIntenta con otro horario.`;
      }
      return `⚠️ Ocurrió un error al guardar tu cita`;
    }
  }

  if (text === "2") {
    session.step = "DONE";
    return `❌ Cita cancelada.\nEscribe *menu* para volver al inicio.`;
  }

  resetSession(session);
  return "❌ Opción inválida. Responde 1 o 2.";
}

export async function confirmarCancelacionCita(
  from: string,
  text: string | undefined,
  session: Session,
) {
  if (text === "1") {
    await Appointment.findByIdAndDelete(session.cancelAppointmentId);

    let reply = "✅ Tu cita ha sido cancelada.";
    reply += regresoAMenuTexto();
    session.step = "DONE";
    resetSession(session);
    return reply;
  }

  if (text === "2") {
    session.step = "AWAITING_MENU";
    let reply = "Volviendo al menú… \n\n";
    reply += await buildMenu(from);
    return reply;
  }

  return "❌ Opción inválida. Responde 1 o 2.";
}

export async function regresoAMenu(from: string, session: Session) {
  session.step = "AWAITING_MENU";
  session.segundoMensaje = await buildMenu(from);
  return "\n\n Redirigiendo al menú principal... \n\n ";
}

export function regresoAMenuTexto() {
  return "\n\n Escribe *menu* si deseas otra opción.";
}

export function resetSession(session: Session) {
  session.step = "MENU";
  delete session.name;
  delete session.email;
  delete session.date;
  delete session.time;
  delete session.available;
  delete session.selectedTime;
  delete session.cancelAppointmentId;
}

export async function verMisDatos(session: Session) {
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

export async function sendMessage(telephone: string, bodyText: string) {
  const response = await fetch(
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

  const data = await response.json();
  console.log("WHATSAPP RESPONSE:", data);
}
