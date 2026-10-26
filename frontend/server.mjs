import http from "node:http";
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

async function proxyToBackend(request, response) {
  try {
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined && !["connection", "content-length", "host", "transfer-encoding"].includes(name)) {
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
    }

    // Fetch connects using BACKEND_URL while Django uses the public frontend
    // host when constructing OAuth callback URLs.
    headers.set("x-tracked-public-host", request.headers.host || "");
    headers.set("x-forwarded-proto", request.headers["x-forwarded-proto"] || "https");
    headers.set("accept-encoding", "identity");

    const hasBody = !["GET", "HEAD"].includes(request.method || "GET");
    const bodyChunks = [];
    if (hasBody) {
      for await (const chunk of request) bodyChunks.push(chunk);
    }
    const upstreamResponse = await fetch(new URL(request.url, backendUrl), {
      method: request.method,
      headers,
      body: hasBody ? Buffer.concat(bodyChunks) : undefined,
      redirect: "manual",
    });
    const responseHeaders = Object.fromEntries(upstreamResponse.headers);
    const setCookies = upstreamResponse.headers.getSetCookie?.() || [];
    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
    delete responseHeaders["content-encoding"];
    responseHeaders["content-length"] = String(responseBody.length);
    if (setCookies.length) responseHeaders["set-cookie"] = setCookies;

    response.writeHead(upstreamResponse.status, responseHeaders);
    response.end(responseBody);
  } catch (error) {
    console.error("Backend proxy request failed:", error.message);
    if (!response.headersSent) {
      response.writeHead(502, { "Content-Type": "application/json" });
    }
    response.end(JSON.stringify({ error: "Backend is unavailable" }));
  }
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
