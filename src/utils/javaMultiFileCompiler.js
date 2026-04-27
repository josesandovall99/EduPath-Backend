/**
 * Merges three Java source files (Main, Modelo, ConsolaIO) into a single compilable
 * source file for submission to Judge0. Only Main keeps its `public` modifier;
 * ConsolaIO and Modelo are downgraded to package-private so Java allows them in
 * a single file named Main.java.
 */

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
  // Only removes `public` from top-level class/interface/enum declarations.
  // Does NOT touch `public` inside methods or fields.
  return code.replace(/^(\s*)public\s+(class|interface|enum)\s+/gm, '$1$2 ');
}

/**
 * Merges Main.java, Modelo (e.g. SeguridadBancaria.java), and ConsolaIO.java into
 * one source string. Returns the merged source ready for Judge0 submission.
 */
function mergeMvcFiles(mainCode, modeloCode, consolaIOCode) {
  const main = extractImportsAndBody(mainCode || '');
  const modelo = extractImportsAndBody(removePublicFromClassDecl(modeloCode || ''));
  const consolaIO = extractImportsAndBody(removePublicFromClassDecl(consolaIOCode || ''));

  // Deduplicate imports (preserve order: consolaIO first, then modelo, then main)
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
