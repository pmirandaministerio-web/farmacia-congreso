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

function imagePath(key) {
  return `/api/image?key=${encodeURIComponent(key)}`;
}

function isDataImage(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

async function saveImage(store, key, value) {
  if (!isDataImage(value)) {
    return value || "";
  }

  await store.set(key, value);
  return imagePath(key);
}

async function prepareProduct(store, product) {
  const cleanProduct = { ...product };

  if (isDataImage(cleanProduct.image)) {
    cleanProduct.image = await saveImage(store, `products/${cleanProduct.id}`, cleanProduct.image);
  }

  return cleanProduct;
}

async function migrateImages(store, currentStore) {
  const nextStore = { ...currentStore };

  if (isDataImage(nextStore.logo)) {
    nextStore.logo = await saveImage(store, "assets/logo", nextStore.logo);
  }

  if (isDataImage(nextStore.heroImage)) {
    nextStore.heroImage = await saveImage(store, "assets/hero", nextStore.heroImage);
  }

  nextStore.products = await Promise.all(
    nextStore.products.map((product) => prepareProduct(store, product))
  );

  return cleanStore(nextStore);
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
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
  const url = new URL(request.url);
  const path = url.pathname;
  const action = url.searchParams.get("action");

  if ((action === "store" || path.endsWith("/api/store")) && request.method === "GET") {
    const savedStore = await store.get("store", { type: "json" });
    return json({ ...initialStore, ...(savedStore || {}) });
  }

  if (request.method !== "GET" && !isValidToken(request)) {
    return json({ error: "Sesion de administrador requerida." }, 401);
  }

  if ((action === "store" || path.endsWith("/api/store")) && request.method === "PUT") {
    try {
      const nextStore = await migrateImages(store, cleanStore(await request.json()));
      await store.setJSON("store", nextStore);
      return json(nextStore);
    } catch (error) {
      return json({ error: error.message || "No se pudo guardar." }, 400);
    }
  }

  if ((action === "product" || path.endsWith("/api/product")) && request.method === "PUT") {
    try {
      const currentStore = { ...initialStore, ...((await store.get("store", { type: "json" })) || {}) };
      const body = await request.json();
      const product = body.product;

      if (!product || !product.id) {
        return json({ error: "Producto invalido." }, 400);
      }

      const productToSave = await prepareProduct(store, product);
      const exists = currentStore.products.some((item) => item.id === product.id);
      const products = exists
        ? currentStore.products.map((item) => (item.id === product.id ? productToSave : item))
        : [productToSave, ...currentStore.products];
      const nextStore = cleanStore({ ...currentStore, products });

      await store.setJSON("store", nextStore);
      return json(nextStore);
    } catch (error) {
      return json({ error: error.message || "No se pudo guardar." }, 400);
    }
  }

  if ((action === "product" || path.endsWith("/api/product")) && request.method === "DELETE") {
    try {
      const currentStore = { ...initialStore, ...((await store.get("store", { type: "json" })) || {}) };
      let id = url.searchParams.get("id");
      if (!id) {
        const body = await request.json();
        id = body.id;
      }
      const nextStore = cleanStore({
        ...currentStore,
        products: currentStore.products.filter((product) => product.id !== id)
      });

      await store.setJSON("store", nextStore);
      return json(nextStore);
    } catch (error) {
      return json({ error: error.message || "No se pudo eliminar." }, 400);
    }
  }

  if ((action === "asset" || path.endsWith("/api/asset")) && request.method === "PUT") {
    if (!isValidToken(request)) {
      return json({ error: "Sesion de administrador requerida." }, 401);
    }

    try {
      const currentStore = { ...initialStore, ...((await store.get("store", { type: "json" })) || {}) };
      const body = await request.json();

      if (!["logo", "heroImage"].includes(body.key)) {
        return json({ error: "Imagen invalida." }, 400);
      }

      const imageKey = body.key === "logo" ? "assets/logo" : "assets/hero";
      const value = await saveImage(store, imageKey, body.value || "");
      const nextStore = cleanStore({ ...currentStore, [body.key]: value });
      await store.setJSON("store", nextStore);
      return json(nextStore);
    } catch (error) {
      return json({ error: error.message || "No se pudo guardar." }, 400);
    }
  }

  if (action === "migrate-images" && request.method === "PUT") {
    try {
      const currentStore = { ...initialStore, ...((await store.get("store", { type: "json" })) || {}) };
      const nextStore = await migrateImages(store, currentStore);
      await store.setJSON("store", nextStore);
      return json(nextStore);
    } catch (error) {
      return json({ error: error.message || "No se pudo preparar el catalogo." }, 400);
    }
  }

  return json({ error: "Metodo no permitido." }, 405);
}
