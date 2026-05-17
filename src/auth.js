const crypto = require("node:crypto");
const { SESSION_SECRET } = require("./config");

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${key}`;
}

function verifyPassword(password, storedHash) {
  const [, salt, key] = String(storedHash || "").split(":");
  if (!salt || !key) return false;
  const computed = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, "hex");
  return expected.length === computed.length && crypto.timingSafeEqual(expected, computed);
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken(userId) {
  const payload = base64url(
    JSON.stringify({
      userId,
      exp: Date.now() + SESSION_TTL_MS
    })
  );
  return `${payload}.${sign(payload)}`;
}

function parseSessionToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.userId || Date.now() > decoded.exp) return null;
    return decoded;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [decodeURIComponent(part.slice(0, index)), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function sessionCookie(token) {
  return `oa_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

function clearSessionCookie() {
  return "oa_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  parseSessionToken,
  parseCookies,
  sessionCookie,
  clearSessionCookie
};
