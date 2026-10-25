import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

import serveHandler from "serve-handler";

const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const backendUrl = new URL(
  process.env.BACKEND_URL || "https://tracked-app-production-8314.up.railway.app",
);
const port = Number(process.env.PORT || 3000);

if (!["http:", "https:"].includes(backendUrl.protocol)) {
  throw new Error("BACKEND_URL must use http or https");
}

export function isBackendPath(requestPath = "") {
  const pathname = requestPath.split("?", 1)[0];
  return pathname === "/api" || pathname.startsWith("/api/")
    || pathname === "/accounts" || pathname.startsWith("/accounts/");
}

function proxyToBackend(request, response) {
  const transport = backendUrl.protocol === "https:" ? https : http;
  const headers = { ...request.headers };

  // Keep the public frontend Host header so Allauth generates OAuth callback
  // URLs on this same origin. The TLS connection still targets BACKEND_URL.
  headers.host = request.headers.host;

  const upstream = transport.request({
    protocol: backendUrl.protocol,
    hostname: backendUrl.hostname,
    port: backendUrl.port || undefined,
    method: request.method,
    path: request.url,
    headers,
    servername: backendUrl.hostname,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });

  upstream.on("error", (error) => {
    console.error("Backend proxy request failed:", error.message);
    if (!response.headersSent) {
      response.writeHead(502, { "Content-Type": "application/json" });
    }
    response.end(JSON.stringify({ error: "Backend is unavailable" }));
  });

  request.pipe(upstream);
}

const server = http.createServer((request, response) => {
  if (isBackendPath(request.url)) {
    proxyToBackend(request, response);
    return;
  }

  serveHandler(request, response, {
    public: publicDirectory,
    cleanUrls: false,
    rewrites: [{ source: "**", destination: "/index.html" }],
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(port, () => {
    console.log(`Frontend listening on port ${port}`);
  });
}
