function normalizarTexto(valor) {
  return (valor || '').toString().trim();
}

function limpiarCodigoMarkdown(valor = '') {
  const texto = (valor || '').toString().trim();
  if (!texto) return '';

  const sinFenceInicio = texto.replace(/^```[a-zA-Z0-9_-]*\s*/i, '');
  const sinFenceFin = sinFenceInicio.replace(/\s*```$/, '');
  return sinFenceFin.trim();
}

function normalizarInputCaso(valor) {
  if (Array.isArray(valor)) {
    return valor.map((item) => normalizarTexto(item)).filter(Boolean).join(',');
  }

  return normalizarTexto(valor);
}

function normalizarCasoPrueba(caso = {}) {
  return {
    inputs: normalizarInputCaso(caso.inputs ?? caso.input ?? caso.entrada ?? ''),
    output: normalizarTexto(caso.output ?? caso.esperado ?? caso.salida ?? '')
  };
}

function parseJavaMethodTemplate(template = '') {
  const texto = limpiarCodigoMarkdown(template);
  if (!texto) return null;

  const firmaMatch = texto.match(/(?:public|private|protected)?\s*(?:static\s+)?([A-Za-z_][A-Za-z0-9_<>,\[\]\s?]*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*\{/);
  if (!firmaMatch) return null;

  const retorno = normalizarTexto(firmaMatch[1]);
  const nombre = normalizarTexto(firmaMatch[2]);
  const rawParametros = normalizarTexto(firmaMatch[3]);
  const parametros = rawParametros
    ? rawParametros.split(',').map((parametro) => parametro.trim()).filter(Boolean).map((parametro, index) => {
        const partes = parametro.split(/\s+/).filter(Boolean);
        if (partes.length < 2) {
          return {
            tipo: partes[0] || 'String',
            nombre: `arg${index}`
          };
        }

        const nombreParametro = partes.pop();
        return {
          tipo: partes.join(' '),
          nombre: nombreParametro
        };
      })
    : [];

  return {
    nombre,
    retorno,
    parametros,
    plantilla: texto
  };
}

function normalizarConfiguracionCompilador({ configuracion = {}, codigoEstructura, resultadoEjercicio }) {
  const plantilla = limpiarCodigoMarkdown(codigoEstructura || configuracion?.metodo?.plantilla || configuracion?.plantillaMetodo || '');
  const metodoDerivado = plantilla ? parseJavaMethodTemplate(plantilla) : null;
  const metodo = metodoDerivado || (configuracion?.metodo ? {
    ...configuracion.metodo,
    plantilla: plantilla || configuracion.metodo.plantilla || ''
  } : null);

  const rawCasos = configuracion?.casos_prueba || configuracion?.casosPrueba || [];
  const casos_prueba = Array.isArray(rawCasos)
    ? rawCasos.map((caso) => normalizarCasoPrueba(caso))
    : [];

  return {
    ...configuracion,
    tipo: 'programacion',
    esperado: normalizarTexto(configuracion?.esperado || resultadoEjercicio || ''),
    metodo,
    casos_prueba
  };
}

function validarConfiguracionCompilador({ configuracion = {}, codigoEstructura }) {
  const errores = [];
  const plantilla = limpiarCodigoMarkdown(codigoEstructura || configuracion?.metodo?.plantilla || configuracion?.plantillaMetodo || '');
  const metodo = parseJavaMethodTemplate(plantilla) || configuracion?.metodo;
  const casos = Array.isArray(configuracion?.casos_prueba) ? configuracion.casos_prueba : [];

  if (!plantilla) {
    errores.push('La plantilla del metodo es obligatoria.');
  }

  if (!metodo || !metodo.nombre || !metodo.retorno) {
    errores.push('No se pudo derivar la firma del metodo desde la plantilla.');
  }

  if (casos.length !== 3) {
    errores.push('El ejercicio debe tener exactamente 3 casos de prueba.');
  }

  casos.forEach((caso, index) => {
    if (typeof caso.inputs !== 'string') {
      errores.push(`Caso ${index + 1}: los inputs deben ser texto.`);
    }
    if (typeof caso.output !== 'string' || !caso.output.trim()) {
      errores.push(`Caso ${index + 1}: el output esperado es obligatorio.`);
    }
  });

  return {
    ok: errores.length === 0,
    errores,
    metodo: metodo || null
  };
}

module.exports = {
  limpiarCodigoMarkdown,
  normalizarCasoPrueba,
  parseJavaMethodTemplate,
  normalizarConfiguracionCompilador,
  validarConfiguracionCompilador
};