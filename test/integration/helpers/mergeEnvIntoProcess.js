/**
 * Vuelca un archivo .env en process.env de forma tolerante:
 * - Quita \0 (típico si el .env se guardó como UTF-16 y se leyó como UTF-8)
 * - BOM UTF-8
 * - Refuerzo línea a línea KEY=valor (sobre lo que haga dotenv.parse)
 */
const fs = require('fs');
const dotenv = require('dotenv');

function mergeEnvIntoProcess(filePath) {
  let raw = fs.readFileSync(filePath, 'utf8');
  raw = raw.replace(/\0/g, '');
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  try {
    Object.assign(process.env, dotenv.parse(raw));
  } catch (_) {
    /* seguir con líneas manuales */
  }

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

module.exports = { mergeEnvIntoProcess };
