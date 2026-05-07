/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Workbox precaches all build assets.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Web Share Target endpoint — receives shared images from the OS share sheet.
const SHARE_CACHE = "share-target-v1";
const SHARE_KEY = "shared-image";

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method === "POST" &&
    url.pathname === "/share-target"
  ) {
    event.respondWith(handleShare(event.request));
    return;
  }
});

async function handleShare(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const file =
      (formData.get("image") as File | null) ||
      (formData.get("file") as File | null);
    if (file && file.size > 0) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        SHARE_KEY,
        new Response(file, {
          headers: {
            "content-type": file.type || "image/png",
            "x-share-name": file.name || "shared.png",
          },
        }),
      );
    }
  } catch (err) {
    console.error("[sw] share-target error", err);
  }
  return Response.redirect("/generate?from-share=1", 303);
}
