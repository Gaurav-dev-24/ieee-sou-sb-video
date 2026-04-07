const fs = require("fs");
const path = require("path");
const http = require("http");

const defaultPort = Number(process.env.PORT) || 3000;
const host = "127.0.0.1";
const rootDir = __dirname;
let currentPort = defaultPort;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { "Content-Type": contentType });
  res.end(body);
}

function safeResolve(urlPath) {
  const pathname = decodeURIComponent(urlPath.split("?")[0]);
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const absolutePath = path.normalize(path.join(rootDir, cleanPath));

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer((req, res) => {
  const filePath = safeResolve(req.url || "/");

  if (!filePath) {
    send(res, 403, "Forbidden\n", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, file) => {
    if (error) {
      if (error.code === "ENOENT") {
        send(res, 404, "Not Found\n", "text/plain; charset=utf-8");
        return;
      }

      send(res, 500, "Internal Server Error\n", "text/plain; charset=utf-8");
      return;
    }

    const contentType =
      MIME_TYPES[path.extname(filePath).toLowerCase()] ||
      "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(file);
  });
});

function startServer(port) {
  currentPort = port;
  server.listen(port, host, () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : currentPort;
    console.log(`Server running at http://${host}:${resolvedPort}`);
  });
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = currentPort + 1;
    console.log(`Port ${currentPort} is busy, trying ${nextPort}...`);
    setTimeout(() => {
      startServer(nextPort);
    }, 100);
    return;
  }

  throw error;
});

startServer(defaultPort);
