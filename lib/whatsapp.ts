export async function sendMessage(telephone: string, message: string) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: telephone,
    type: "text",
    text: {
      preview_url: false,
      body: message,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("WHATSAPP ENVIO ERROR ", data);
  } else {
    console.log("WHATSAPP RESPODIO: ", data);
  }

  return data;
}
