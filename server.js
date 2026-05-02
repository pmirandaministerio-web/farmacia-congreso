const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const IMAGE_DIR = path.join(DATA_DIR, "images");
const DIST_DIR = path.join(__dirname, "dist");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "congreso2026";
const ADMIN_SECRET = process.env.ADMIN_SECRET || ADMIN_PASSWORD;

const initialStore = {
  logo: "",
  heroImage: "",
  products: []
};

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialStore, null, 2));
  }
}

function isDataImage(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function safeImageKey(key) {
  return key.replace(/[^a-zA-Z0-9/_-]/g, "");
}

function imagePath(key) {
  return `/api/image?key=${encodeURIComponent(key)}`;
}

function saveImage(key, value) {
  if (!isDataImage(value)) {
    return value || "";
  }

  ensureDataFile();
  const safeKey = safeImageKey(key);
  const filePath = path.join(IMAGE_DIR, `${safeKey}.txt`);
  const dir = path.dirname(filePath);

  if (!dir.startsWith(IMAGE_DIR)) {
    return "";
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, value);
  return imagePath(key);
}

function prepareProduct(product) {
  const cleanProduct = { ...product };
  if (isDataImage(cleanProduct.image)) {
    cleanProduct.image = saveImage(`products/${cleanProduct.id}`, cleanProduct.image);
  }
  return cleanProduct;
}

function migrateImages(currentStore) {
  const nextStore = { ...currentStore };
  if (isDataImage(nextStore.logo)) {
    nextStore.logo = saveImage("assets/logo", nextStore.logo);
  }
  if (isDataImage(nextStore.heroImage)) {
    nextStore.heroImage = saveImage("assets/hero", nextStore.heroImage);
  }
  nextStore.products = nextStore.products.map(prepareProduct);
  return writeStore(nextStore);
}

function readStore() {
  ensureDataFile();
  try {
    return { ...initialStore, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
  } catch {
    return initialStore;
  }
}

function writeStore(store) {
  ensureDataFile();
  const cleanStore = {
    logo: typeof store.logo === "string" ? store.logo : "",
    heroImage: typeof store.heroImage === "string" ? store.heroImage : "",
    products: Array.isArray(store.products) ? store.products : []
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(cleanStore, null, 2));
  return cleanStore;
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(payload));
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

function isValidToken(request) {
  const header = request.headers.authorization || "";
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

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error("El archivo es demasiado grande."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml"
  };
  return types[ext] || "application/octet-stream";
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const safePath = requestedPath === "/" ? "/index.html" : requestedPath;
  const filePath = path.normalize(path.join(DIST_DIR, safePath));

  if (!filePath.startsWith(DIST_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  const finalPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(DIST_DIR, "index.html");

  fs.readFile(finalPath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(finalPath) });
    response.end(content);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url.startsWith("/api/store") && request.method === "GET") {
    sendJson(response, 200, readStore());
    return;
  }

  if (request.url.startsWith("/api/login") && request.method === "POST") {
    try {
      const credentials = JSON.parse(await readBody(request));
      if (credentials.user === ADMIN_USER && credentials.pass === ADMIN_PASSWORD) {
        sendJson(response, 200, { token: createToken() });
        return;
      }
      sendJson(response, 401, { error: "Usuario o contraseña incorrectos." });
    } catch {
      sendJson(response, 400, { error: "No se pudo iniciar sesión." });
    }
    return;
  }

  if (request.url.startsWith("/api/store") && request.method === "PUT") {
    if (!isValidToken(request)) {
      sendJson(response, 401, { error: "Sesion de administrador requerida." });
      return;
    }

    try {
      const body = await readBody(request);
      const store = writeStore(JSON.parse(body));
      sendJson(response, 200, store);
    } catch (error) {
      sendJson(response, 400, { error: error.message || "No se pudo guardar." });
    }
    return;
  }

  if (request.url.startsWith("/api/product")) {
    if (!isValidToken(request)) {
      sendJson(response, 401, { error: "Sesion de administrador requerida." });
      return;
    }

    try {
      const currentStore = readStore();

      if (request.method === "PUT") {
        const body = JSON.parse(await readBody(request));
        const product = body.product;

        if (!product || !product.id) {
          sendJson(response, 400, { error: "Producto invalido." });
          return;
        }

        const productToSave = prepareProduct(product);
        const exists = currentStore.products.some((item) => item.id === product.id);
        const products = exists
          ? currentStore.products.map((item) => (item.id === product.id ? productToSave : item))
          : [productToSave, ...currentStore.products];

        sendJson(response, 200, writeStore({ ...currentStore, products }));
        return;
      }

      if (request.method === "DELETE") {
        const url = new URL(request.url, `http://${request.headers.host}`);
        let id = url.searchParams.get("id");
        if (!id) {
          const body = JSON.parse(await readBody(request) || "{}");
          id = body.id;
        }
        const products = currentStore.products.filter((product) => product.id !== id);
        sendJson(response, 200, writeStore({ ...currentStore, products }));
        return;
      }
    } catch (error) {
      sendJson(response, 400, { error: error.message || "No se pudo guardar." });
      return;
    }
  }

  if (request.url.startsWith("/api/asset") && request.method === "PUT") {
    if (!isValidToken(request)) {
      sendJson(response, 401, { error: "Sesion de administrador requerida." });
      return;
    }

    try {
      const body = JSON.parse(await readBody(request));
      if (!["logo", "heroImage"].includes(body.key)) {
        sendJson(response, 400, { error: "Imagen invalida." });
        return;
      }

      const currentStore = readStore();
      const imageKey = body.key === "logo" ? "assets/logo" : "assets/hero";
      const value = saveImage(imageKey, body.value || "");
      sendJson(response, 200, writeStore({ ...currentStore, [body.key]: value }));
    } catch (error) {
      sendJson(response, 400, { error: error.message || "No se pudo guardar." });
    }
    return;
  }

  if (request.url.startsWith("/api/migrate-images") && request.method === "PUT") {
    if (!isValidToken(request)) {
      sendJson(response, 401, { error: "Sesion de administrador requerida." });
      return;
    }
    sendJson(response, 200, migrateImages(readStore()));
    return;
  }

  if (request.url.startsWith("/api/image") && request.method === "GET") {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const key = safeImageKey(url.searchParams.get("key") || "");
    const filePath = path.join(IMAGE_DIR, `${key}.txt`);

    if (!filePath.startsWith(IMAGE_DIR) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end("Imagen no encontrada");
      return;
    }

    const dataUrl = fs.readFileSync(filePath, "utf8");
    const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) {
      response.writeHead(404);
      response.end("Imagen no encontrada");
      return;
    }

    response.writeHead(200, {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=31536000, immutable"
    });
    response.end(Buffer.from(match[2], "base64"));
    return;
  }

  serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Farmacia B Congreso online en http://127.0.0.1:${PORT}`);
});
