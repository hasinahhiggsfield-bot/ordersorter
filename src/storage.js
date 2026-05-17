const fs = require("node:fs");
const path = require("node:path");
const { DATA_FILE } = require("./config");
const { createSeedDatabase } = require("./mockZid");

function ensureDirectory() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

function resetDatabase() {
  ensureDirectory();
  fs.writeFileSync(DATA_FILE, JSON.stringify(createSeedDatabase(), null, 2));
}

function ensureDatabase() {
  ensureDirectory();
  if (!fs.existsSync(DATA_FILE)) resetDatabase();
}

function readDatabase() {
  ensureDatabase();
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeDatabase(db) {
  ensureDirectory();
  const temporaryFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(db, null, 2));
  fs.renameSync(temporaryFile, DATA_FILE);
}

function withDatabase(callback) {
  const db = readDatabase();
  const result = callback(db);
  writeDatabase(db);
  return result;
}

async function withDatabaseAsync(callback) {
  const db = readDatabase();
  const result = await callback(db);
  writeDatabase(db);
  return result;
}

module.exports = {
  DATA_FILE,
  ensureDatabase,
  resetDatabase,
  readDatabase,
  writeDatabase,
  withDatabase,
  withDatabaseAsync
};
