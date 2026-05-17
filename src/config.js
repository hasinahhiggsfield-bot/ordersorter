const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_DATA_DIR = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "OperationAssist")
  : path.join(ROOT_DIR, ".local-data");

function loadEnvFile() {
  const envPath = path.join(ROOT_DIR, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").trim();
  }
}

loadEnvFile();

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

module.exports = {
  ROOT_DIR,
  PUBLIC_DIR: path.join(ROOT_DIR, "public"),
  DATA_FILE: path.resolve(ROOT_DIR, process.env.DATA_FILE || path.join(DEFAULT_DATA_DIR, "db.json")),
  HOST: process.env.HOST || "0.0.0.0",
  PORT: numberEnv("PORT", 4310),
  SESSION_SECRET: process.env.SESSION_SECRET || "operation-assist-local-development-secret",
  ZID_SYNC_INTERVAL_MS: numberEnv("ZID_SYNC_INTERVAL_MS", 5 * 60 * 1000),
  WORKER_INACTIVITY_WARNING_MS: numberEnv("WORKER_INACTIVITY_WARNING_MS", 10 * 60 * 1000),
  STUCK_ORDER_MS: numberEnv("STUCK_ORDER_MS", 45 * 60 * 1000),
  ZID: {
    apiBaseUrl: process.env.ZID_API_BASE_URL || "",
    clientId: process.env.ZID_CLIENT_ID || "",
    clientSecret: process.env.ZID_CLIENT_SECRET || "",
    accessToken: process.env.ZID_ACCESS_TOKEN || ""
  }
};
