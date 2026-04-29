const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
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

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialStore, null, 2));
  }
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

  serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Farmacia B Congreso online en http://127.0.0.1:${PORT}`);
});
