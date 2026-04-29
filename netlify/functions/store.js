const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "congreso2026";
const ADMIN_SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;

const initialStore = {
  logo: "",
  heroImage: "",
  products: []
};

function cleanStore(store) {
  return {
    logo: typeof store.logo === "string" ? store.logo : "",
    heroImage: typeof store.heroImage === "string" ? store.heroImage : "",
    products: Array.isArray(store.products) ? store.products : []
  };
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    },
    body: JSON.stringify(body)
  };
}

function sign(value) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(value).digest("base64url");
}

function isValidToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");

  if (!payload || !signature || sign(payload) !== signature) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.user === ADMIN_USER && data.expires > Date.now();
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return response(200, { ok: true });
  }

  const store = getStore("farmacia-congreso");

  if (event.httpMethod === "GET") {
    const savedStore = await store.get("store", { type: "json" });
    return response(200, { ...initialStore, ...(savedStore || {}) });
  }

  if (event.httpMethod === "PUT") {
    if (!isValidToken(event)) {
      return response(401, { error: "Sesion de administrador requerida." });
    }

    try {
      const nextStore = cleanStore(JSON.parse(event.body || "{}"));
      await store.setJSON("store", nextStore);
      return response(200, nextStore);
    } catch (error) {
      return response(400, { error: error.message || "No se pudo guardar." });
    }
  }

  return response(405, { error: "Metodo no permitido." });
};
