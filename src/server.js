const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const {
  HOST,
  PORT,
  PUBLIC_DIR,
  ZID_SYNC_INTERVAL_MS
} = require("./config");
const {
  resetDatabase,
  ensureDatabase,
  readDatabase,
  withDatabase,
  DATA_FILE
} = require("./storage");
const {
  verifyPassword,
  createSessionToken,
  parseSessionToken,
  parseCookies,
  sessionCookie,
  clearSessionCookie
} = require("./auth");
const {
  publicUser,
  hydrateOrder,
  updateWorkerActivity,
  workerCurrent,
  completeOrder,
  reportMissing,
  syncFromZid,
  getDashboard,
  stockArrived,
  unlockOrder,
  returnToQueue,
  reassignOrder,
  addInternalNote,
  escalateOrder
} = require("./services/orders");
const {
  getShippingSummary,
  updateShippingSettings,
  testPrint
} = require("./services/shipping");
const {
  getZidSummary,
  updateZidSettings,
  simulateActivation,
  handleZidWebhook
} = require("./services/zid");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

if (process.argv.includes("--reset-data")) {
  resetDatabase();
  console.log(`Reset Operation Assist data at ${DATA_FILE}`);
  process.exit(0);
}

ensureDatabase();

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function sendError(res, error) {
  const status = error.status || 500;
  sendJson(res, status, {
    error: status === 500 ? "Unexpected server error." : error.message
  });
  if (status === 500) console.error(error);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        req.destroy();
      }
    });
    req.on("error", reject);
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Invalid JSON body."), { status: 400 }));
      }
    });
  });
}

function authenticatedUser(req, db) {
  const cookies = parseCookies(req);
  const session = parseSessionToken(cookies.oa_session);
  if (!session) return null;
  const user = db.users.find((item) => item.id === session.userId && item.active_status);
  return user || null;
}

function requireUser(req, db, roles = []) {
  const user = authenticatedUser(req, db);
  if (!user) {
    const error = new Error("Authentication required.");
    error.status = 401;
    throw error;
  }
  if (roles.length && !roles.includes(user.role)) {
    const error = new Error("This account does not have access to that operation.");
    error.status = 403;
    throw error;
  }
  return user;
}

function orderIdFrom(pathname, prefix, suffix = "") {
  if (!pathname.startsWith(prefix) || (suffix && !pathname.endsWith(suffix))) return null;
  const start = prefix.length;
  const end = suffix ? pathname.length - suffix.length : pathname.length;
  return decodeURIComponent(pathname.slice(start, end));
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    const result = withDatabase((db) => {
      const user = db.users.find((item) => item.email.toLowerCase() === String(body.email || "").toLowerCase());
      if (!user || !verifyPassword(String(body.password || ""), user.password_hash)) {
        const error = new Error("Invalid email or password.");
        error.status = 401;
        throw error;
      }
      if (!user.active_status) {
        const error = new Error("This account is disabled.");
        error.status = 403;
        throw error;
      }
      user.last_active_at = new Date().toISOString();
      return {
        token: createSessionToken(user.id),
        user: publicUser(user)
      };
    });
    sendJson(res, 200, { user: result.user }, { "set-cookie": sessionCookie(result.token) });
    return;
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    sendJson(res, 200, { ok: true }, { "set-cookie": clearSessionCookie() });
    return;
  }

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const db = readDatabase();
    const user = authenticatedUser(req, db);
    sendJson(res, 200, { user: publicUser(user) });
    return;
  }

  if (url.pathname === "/api/worker/current" && req.method === "GET") {
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["worker"]);
      return workerCurrent(db, user.id);
    });
    sendJson(res, 200, { order: result });
    return;
  }

  if (url.pathname === "/api/worker/heartbeat" && req.method === "POST") {
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["worker"]);
      updateWorkerActivity(db, user.id);
      return publicUser(user);
    });
    sendJson(res, 200, { user: result });
    return;
  }

  let orderId = orderIdFrom(url.pathname, "/api/worker/orders/", "/ready");
  if (orderId && req.method === "POST") {
    await readBody(req);
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["worker"]);
      return completeOrder(db, user.id, orderId);
    });
    sendJson(res, 200, result);
    return;
  }

  orderId = orderIdFrom(url.pathname, "/api/worker/orders/", "/missing");
  if (orderId && req.method === "POST") {
    const body = await readBody(req);
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["worker"]);
      return reportMissing(db, user.id, orderId, body);
    });
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/admin/dashboard" && req.method === "GET") {
    const db = readDatabase();
    requireUser(req, db, ["admin"]);
    sendJson(res, 200, getDashboard(db));
    return;
  }

  if (url.pathname === "/api/admin/orders" && req.method === "GET") {
    const db = readDatabase();
    requireUser(req, db, ["admin"]);
    sendJson(res, 200, {
      orders: db.orders.map((order) => hydrateOrder(db, order)).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    });
    return;
  }

  orderId = orderIdFrom(url.pathname, "/api/admin/orders/");
  if (orderId && req.method === "GET" && !orderId.includes("/")) {
    const db = readDatabase();
    requireUser(req, db, ["admin"]);
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) throw Object.assign(new Error("Order was not found."), { status: 404 });
    sendJson(res, 200, { order: hydrateOrder(db, order) });
    return;
  }

  if (url.pathname === "/api/admin/sync" && req.method === "POST") {
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return syncFromZid(db, user.id, 2);
    });
    sendJson(res, 200, { imported: result });
    return;
  }

  if (url.pathname === "/api/admin/shipping" && req.method === "GET") {
    const db = readDatabase();
    requireUser(req, db, ["admin"]);
    sendJson(res, 200, getShippingSummary(db));
    return;
  }

  if (url.pathname === "/api/admin/shipping/settings" && req.method === "POST") {
    const body = await readBody(req);
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return updateShippingSettings(db, body, user.id);
    });
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/admin/shipping/test-print" && req.method === "POST") {
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return testPrint(db, user.id);
    });
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/admin/zid" && req.method === "GET") {
    const db = readDatabase();
    requireUser(req, db, ["admin"]);
    sendJson(res, 200, getZidSummary(db));
    return;
  }

  if (url.pathname === "/api/admin/zid/settings" && req.method === "POST") {
    const body = await readBody(req);
    const result = withDatabase((db) => {
      requireUser(req, db, ["admin"]);
      return updateZidSettings(db, body);
    });
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/admin/zid/simulate-activation" && req.method === "POST") {
    const body = await readBody(req);
    const result = withDatabase((db) => {
      requireUser(req, db, ["admin"]);
      return simulateActivation(db, body.storeId || "mock-store");
    });
    sendJson(res, 200, result);
    return;
  }

  if (url.pathname === "/api/zid/webhooks" && req.method === "POST") {
    const body = await readBody(req);
    const result = withDatabase((db) => handleZidWebhook(db, body));
    sendJson(res, 200, { ok: true, zid: result });
    return;
  }

  orderId = orderIdFrom(url.pathname, "/api/admin/orders/", "/stock-arrived");
  if (orderId && req.method === "POST") {
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return stockArrived(db, orderId, user.id);
    });
    sendJson(res, 200, { order: result });
    return;
  }

  orderId = orderIdFrom(url.pathname, "/api/admin/orders/", "/unlock");
  if (orderId && req.method === "POST") {
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return unlockOrder(db, orderId, user.id);
    });
    sendJson(res, 200, { order: result });
    return;
  }

  orderId = orderIdFrom(url.pathname, "/api/admin/orders/", "/return-to-queue");
  if (orderId && req.method === "POST") {
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return returnToQueue(db, orderId, user.id);
    });
    sendJson(res, 200, { order: result });
    return;
  }

  orderId = orderIdFrom(url.pathname, "/api/admin/orders/", "/reassign");
  if (orderId && req.method === "POST") {
    const body = await readBody(req);
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return reassignOrder(db, orderId, body.workerId, user.id);
    });
    sendJson(res, 200, { order: result });
    return;
  }

  orderId = orderIdFrom(url.pathname, "/api/admin/orders/", "/note");
  if (orderId && req.method === "POST") {
    const body = await readBody(req);
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return addInternalNote(db, orderId, user.id, body.note);
    });
    sendJson(res, 200, { order: result });
    return;
  }

  orderId = orderIdFrom(url.pathname, "/api/admin/orders/", "/escalate");
  if (orderId && req.method === "POST") {
    const result = withDatabase((db) => {
      const user = requireUser(req, db, ["admin"]);
      return escalateOrder(db, orderId, user.id);
    });
    sendJson(res, 200, { order: result });
    return;
  }

  sendJson(res, 404, { error: "API route was not found." });
}

function serveStatic(req, res, url) {
  const requestedPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "content-type": MIME_TYPES[extension] || "application/octet-stream",
    "cache-control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    sendError(res, error);
  }
});

setInterval(() => {
  try {
    const imported = withDatabase((db) => syncFromZid(db, null, 1));
    if (imported.length) {
      console.log(`[zid-sync] Imported ${imported.length} mock order at ${new Date().toISOString()}`);
    }
  } catch (error) {
    console.error("[zid-sync] failed", error);
  }
}, ZID_SYNC_INTERVAL_MS).unref();

server.listen(PORT, HOST, () => {
  console.log(`Operation Assist running at http://localhost:${PORT}`);
});
