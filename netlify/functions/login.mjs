import crypto from "node:crypto";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "congreso2026";
const ADMIN_SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function sign(value) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(value).digest("base64url");
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({
    user: ADMIN_USER,
    expires: Date.now() + 1000 * 60 * 60 * 12
  })).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Metodo no permitido." }, 405);
  }

  try {
    const credentials = await request.json();

    if (credentials.user === ADMIN_USER && credentials.pass === ADMIN_PASSWORD) {
      return json({ token: createToken() });
    }

    return json({ error: "Usuario o contrasena incorrectos." }, 401);
  } catch {
    return json({ error: "No se pudo iniciar sesion." }, 400);
  }
}
