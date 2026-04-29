import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "congreso2026";
const ADMIN_SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;

const initialStore = {
  logo: "",
  heroImage: "",
  products: []
};

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    }
  });
}

function cleanStore(store) {
  return {
    logo: typeof store.logo === "string" ? store.logo : "",
    heroImage: typeof store.heroImage === "string" ? store.heroImage : "",
    products: Array.isArray(store.products) ? store.products : []
  };
}

function sign(value) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(value).digest("base64url");
}

function isValidToken(request) {
  const header = request.headers.get("authorization") || "";
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

export default async function handler(request) {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  const store = getStore("farmacia-congreso");

  if (request.method === "GET") {
    const savedStore = await store.get("store", { type: "json" });
    return json({ ...initialStore, ...(savedStore || {}) });
  }

  if (request.method === "PUT") {
    if (!isValidToken(request)) {
      return json({ error: "Sesion de administrador requerida." }, 401);
    }

    try {
      const nextStore = cleanStore(await request.json());
      await store.setJSON("store", nextStore);
      return json(nextStore);
    } catch (error) {
      return json({ error: error.message || "No se pudo guardar." }, 400);
    }
  }

  return json({ error: "Metodo no permitido." }, 405);
}
