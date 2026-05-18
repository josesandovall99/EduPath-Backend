// Fusiona tres archivos Java (Main, Modelo, ConsolaIO) en un único fuente compilable para Judge0.
// Solo Main conserva `public`; Modelo y ConsolaIO pasan a package-private para permitir una sola clase pública.

function extractImportsAndBody(code) {
  const lines = (code || '').split('\n');
  const imports = [];
  const bodyLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^package\s+/.test(trimmed) || /^import\s+/.test(trimmed)) {
      imports.push(trimmed);
    } else {
      bodyLines.push(line);
    }
  }

  return { imports, body: bodyLines.join('\n') };
}

function removePublicFromClassDecl(code) {
  // Solo elimina `public` de declaraciones de clase/interfaz/enum en nivel superior.
  return code.replace(/^(\s*)public\s+(class|interface|enum)\s+/gm, '$1$2 ');
}

function mergeMvcFiles(mainCode, modeloCode, consolaIOCode) {
  const main = extractImportsAndBody(mainCode || '');
  const modelo = extractImportsAndBody(removePublicFromClassDecl(modeloCode || ''));
  const consolaIO = extractImportsAndBody(removePublicFromClassDecl(consolaIOCode || ''));

  // Deduplicar imports (orden: consolaIO primero, luego modelo, luego main)
  const seen = new Set();
  const allImports = [];
  for (const imp of [...consolaIO.imports, ...modelo.imports, ...main.imports]) {
    if (imp && !seen.has(imp)) {
      seen.add(imp);
      allImports.push(imp);
    }
  }

  const parts = [
    allImports.join('\n'),
    consolaIO.body.trim(),
    modelo.body.trim(),
    main.body.trim()
  ].filter(Boolean);

  return parts.join('\n\n');
}

module.exports = { mergeMvcFiles };
