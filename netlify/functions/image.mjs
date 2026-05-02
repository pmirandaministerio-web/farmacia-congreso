import { getStore } from "@netlify/blobs";

function notFound() {
  return new Response("Imagen no encontrada", { status: 404 });
}

export default async function handler(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!key) {
    return notFound();
  }

  const store = getStore("farmacia-congreso");
  const dataUrl = await store.get(key);

  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return notFound();
  }

  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    return notFound();
  }

  const bytes = Buffer.from(match[2], "base64");

  return new Response(bytes, {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
