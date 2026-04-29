const crypto = require("crypto");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "congreso2026";
const ADMIN_SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(body)
  };
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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return response(200, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Metodo no permitido." });
  }

  try {
    const credentials = JSON.parse(event.body || "{}");
    if (credentials.user === ADMIN_USER && credentials.pass === ADMIN_PASSWORD) {
      return response(200, { token: createToken() });
    }
    return response(401, { error: "Usuario o contraseña incorrectos." });
  } catch {
    return response(400, { error: "No se pudo iniciar sesion." });
  }
};
