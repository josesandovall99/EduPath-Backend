function escapeJavaString(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\"/g, '\\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function limpiarCodigoMarkdown(valor = '') {
  const texto = (valor || '').toString().trim();
  if (!texto) return '';

  const sinFenceInicio = texto.replace(/^```[a-zA-Z0-9_-]*\s*/i, '');
  const sinFenceFin = sinFenceInicio.replace(/\s*```$/, '');
  return sinFenceFin.trim();
}

function tieneMainJava(codigo = '') {
  const texto = (codigo || '').toString();
  const withoutComments = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return /public\s+static\s+void\s+main\s*\(\s*String\s*\[\s*\]\s*\w*\s*\)/i.test(withoutComments)
    || /static\s+void\s+main\s*\(/i.test(withoutComments);
}

function parseInputs(inputs) {
  const raw = (inputs || '').toString().trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  if (lines.length === 1) {
    return raw.split(/[\s,]+/).filter(Boolean);
  }
  return lines.reduce((result, line) => result.concat(line.split(/[\s,]+/).filter(Boolean)), []);
}

function obtenerPreambulo(codigo) {
  const lines = (codigo || '').split(/\r?\n/);
  const preambulo = [];
  const resto = [];
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^package\s+/.test(trimmed) || /^import\s+/.test(trimmed)) {
      preambulo.push(line);
    } else {
      resto.push(line);
    }
  });
  return { preambulo: preambulo.join('\n'), resto: resto.join('\n') };
}

function escaparRegex(texto = '') {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tieneMetodoJava(codigo = '') {
  const texto = (codigo || '').toString();
  const withoutComments = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return /(public|private|protected)?\s*(static\s+)?[A-Za-z_][A-Za-z0-9_<>,\[\]]*\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*\{/i.test(withoutComments);
}

function generarFirmaMetodo(metodo) {
  const retorno = (metodo?.retorno || 'void').trim() || 'void';
  const nombre = (metodo?.nombre || 'metodo').trim() || 'metodo';
  const parametros = Array.isArray(metodo?.parametros)
    ? metodo.parametros.map((param, index) => {
        const tipo = (param?.tipo || 'String').trim();
        const nombreParam = (param?.nombre || `arg${index}`).trim();
        return `${tipo} ${nombreParam}`;
      }).join(', ')
    : '';

  return `public static ${retorno} ${nombre}(${parametros})`;
}

function extraerFirmaDePlantilla(plantilla = '') {
  const texto = (plantilla || '').toString();
  const match = texto.match(/(public|private|protected)?\s*(static\s+)?[A-Za-z_][A-Za-z0-9_<>,\[\]]*\s+[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*\{/i);
  if (!match) return null;
  return match[0].replace(/\{\s*$/, '').trim();
}

function extraerBloqueBalanceado(texto = '', braceIndex = -1) {
  if (braceIndex < 0 || texto[braceIndex] !== '{') {
    return null;
  }

  let depth = 0;
  let inString = false;
  let inChar = false;
  let lineComment = false;
  let blockComment = false;
  let escaped = false;

  for (let i = braceIndex; i < texto.length; i++) {
    const current = texto[i];
    const next = texto[i + 1];

    if (lineComment) {
      if (current === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (current === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      if (!escaped && current === '"') inString = false;
      escaped = !escaped && current === '\\';
      continue;
    }

    if (inChar) {
      if (!escaped && current === "'") inChar = false;
      escaped = !escaped && current === '\\';
      continue;
    }

    escaped = false;

    if (current === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (current === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    if (current === '"') {
      inString = true;
      continue;
    }

    if (current === "'") {
      inChar = true;
      continue;
    }

    if (current === '{') {
      depth += 1;
    } else if (current === '}') {
      depth -= 1;
      if (depth === 0) {
        return texto.slice(braceIndex, i + 1);
      }
    }
  }

  return null;
}

function extraerMetodoJava(codigo = '', metodo = {}) {
  const nombreMetodo = (metodo?.nombre || '').trim();
  if (!nombreMetodo) return null;

  const pattern = new RegExp(
    `((public|private|protected)\\s+)?(static\\s+)?([A-Za-z_][A-Za-z0-9_<>\\[\\],\\s]*)\\s+${escaparRegex(nombreMetodo)}\\s*\\([^)]*\\)\\s*\\{`,
    'g'
  );

  let match;
  while ((match = pattern.exec(codigo)) !== null) {
    const start = match.index;
    const braceIndex = codigo.indexOf('{', start);
    const bloque = extraerBloqueBalanceado(codigo, braceIndex);
    if (!bloque) continue;
    return `${match[0]}${bloque.slice(1)}`;
  }

  return null;
}

function normalizarCodigoJavaEstudiante(codigo = '', metodo = {}) {
  const texto = limpiarCodigoMarkdown(codigo);
  if (!texto.trim()) return texto;

  if (!tieneClaseJava(texto) && !tieneMainJava(texto)) {
    return texto;
  }

  const metodoExtraido = extraerMetodoJava(texto, metodo);
  if (!metodoExtraido) {
    return texto;
  }

  const { preambulo } = obtenerPreambulo(texto);
  return [preambulo, metodoExtraido].filter(Boolean).join('\n\n');
}

function indentCode(code, level = 2) {
  const pad = ' '.repeat(level * 2);
  return code
    .split(/\r?\n/)
    .map((line) => (line.trim() === '' ? '' : `${pad}${line}`))
    .join('\n');
}

function generarMetodoDesdePlantilla(codigo, metodo) {
  const body = (codigo || '').trim();
  let firma = null;

  if (typeof metodo?.plantilla === 'string' && metodo.plantilla.trim()) {
    firma = extraerFirmaDePlantilla(metodo.plantilla);
  }

  if (!firma) {
    firma = generarFirmaMetodo(metodo);
  }

  if (!firma) {
    return codigo;
  }

  return `${firma} {
${indentCode(body, 2)}
    }`;
}

function tieneClaseJava(codigo = '') {
  const texto = (codigo || '').toString();
  return /\bclass\s+[A-Za-z_][A-Za-z0-9_]*\b/.test(texto);
}

function valorJava(raw, tipo) {
  const targetTipo = (tipo || '').trim();
  if (targetTipo === '') {
    return `"${escapeJavaString(raw)}"`;
  }

  const lower = targetTipo.toLowerCase();
  if (['int', 'long', 'short', 'byte'].includes(lower)) {
    return raw === '' ? '0' : raw;
  }
  if (['double', 'float'].includes(lower)) {
    return raw === '' ? '0.0' : raw;
  }
  if (lower === 'boolean') {
    const normalized = raw.toLowerCase();
    return normalized === 'true' ? 'true' : 'false';
  }
  if (lower === 'char') {
    const charValue = raw.charAt(0) || '\\u0000';
    return `'${escapeJavaString(charValue)}'`;
  }
  if (lower.endsWith('[]')) {
    const baseType = lower.replace(/\[\]$/, '');
    const values = raw.split(/\s+/).filter(Boolean).map(v => valorJava(v, baseType));
    return `{ ${values.join(', ')} }`;
  }
  return `"${escapeJavaString(raw)}"`;
}

function generarMainJava(metodo, inputs) {
  const parametros = Array.isArray(metodo?.parametros) ? metodo.parametros : [];
  const valores = parseInputs(inputs);
  const declaraciones = parametros.map((param, index) => {
    const tipo = (param?.tipo || 'String').trim();
    const nombre = (param?.nombre || `arg${index}`).trim();
    const raw = valores[index] || '';
    return `        ${tipo} ${nombre} = ${valorJava(raw, tipo)};`;
  });

  const invocation = `${metodo.nombre}(${parametros.map((param) => (param?.nombre || '').trim() || 'null').join(', ')})`;
  const invocationLine = metodo.retorno && metodo.retorno.toString().trim().toLowerCase() !== 'void'
    ? `        System.out.print(${invocation});`
    : `        ${invocation};`;

  return [
    '    public static void main(String[] args) {',
    ...declaraciones,
    invocationLine,
    '    }'
  ].join('\n');
}

function wrapJavaCodeForJudge0(codigo, metodo, inputs) {
  if (!codigo || typeof codigo !== 'string') {
    return codigo;
  }

  let codigoAutor = normalizarCodigoJavaEstudiante(codigo, metodo);
  if (!tieneMetodoJava(codigoAutor)) {
    codigoAutor = generarMetodoDesdePlantilla(codigoAutor, metodo);
  }

  if (!codigoAutor || typeof codigoAutor !== 'string') {
    return codigo;
  }

  const { preambulo, resto } = obtenerPreambulo(codigoAutor);
  const mainCode = generarMainJava(metodo, inputs);

  if (tieneClaseJava(resto)) {
    // Si la entrada ya define una clase (por ejemplo Solution), no la encerramos de nuevo.
    return [preambulo, resto, '', mainCode].filter(Boolean).join('\n\n');
  }

  const classCode = [`public class Main {`, mainCode, '', resto, `}`].filter(Boolean).join('\n');
  return [preambulo, classCode].filter(Boolean).join('\n\n');
}

module.exports = {
  limpiarCodigoMarkdown,
  normalizarCodigoJavaEstudiante,
  tieneMainJava,
  wrapJavaCodeForJudge0
};
