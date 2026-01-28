// Servicio de validación de Diagramas UML
// Entrada esperada: { cells: [...] } con elementos tipo 'standard.Rectangle' (clases) y 'standard.Link' (relaciones)

function validate(diagram, options = {}) {
  const opts = {
    minClasses: options.minClasses ?? 2,
    requireRelationships: options.requireRelationships ?? false,
    requireMultiplicities: options.requireMultiplicities ?? false,
  };

  if (!diagram) {
    return {
      success: false,
      message: 'No se recibió el diagrama',
      errors: [{ type: 'MISSING_DIAGRAM', severity: 'error', message: 'El campo "diagram" es requerido' }],
      warnings: []
    };
  }

  try {
    const errors = [];
    const warnings = [];

    const classes = diagram.cells?.filter(cell => cell.type === 'standard.Rectangle') || [];
    const links = diagram.cells?.filter(cell => cell.type === 'standard.Link') || [];

    // Reglas básicas
    if (classes.length < opts.minClasses) {
      errors.push({
        type: 'EMPTY_DIAGRAM',
        severity: 'error',
        message: `El diagrama debe contener al menos ${opts.minClasses} clases`,
        details: `Se encontraron ${classes.length} clase(s)`
      });
    }

    // Validaciones de clases
    const classNames = new Map();
    classes.forEach(classElement => {
      const classId = classElement.id;
      const labelText = classElement.attrs?.label?.text || '';

      if (!labelText?.trim()) {
        errors.push({
          type: 'MISSING_CLASS_NAME', severity: 'error',
          message: 'Una clase no tiene nombre', elementId: classId,
          location: 'Clase sin nombre', details: 'El label de la clase está vacío'
        });
        return;
      }

      const lines = labelText.split('\n').map(l => l.trim()).filter(l => l);
      const className = lines[0];

      if (!className || className.length < 1 || className.length > 100 || !/^[a-zA-Z0-9_]+$/.test(className)) {
        errors.push({
          type: 'INVALID_CLASS_NAME', severity: 'error',
          message: `Nombre de clase inválido: "${className}"`, elementId: classId,
          location: `Clase: ${className}`, details: '1..100 chars, [a-zA-Z0-9_]'
        });
        return;
      }

      if (classNames.has(className)) {
        errors.push({
          type: 'DUPLICATE_CLASS_NAME', severity: 'error',
          message: `La clase '${className}' está duplicada`, elementId: classId,
          location: `Clase: ${className}`
        });
      } else {
        classNames.set(className, classId);
      }

      // Atributos y métodos
      const classAttributes = new Map();
      const classMethods = new Map();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const prefix = line[0];
        if (prefix !== '+' && prefix !== '-') {
          errors.push({
            type: 'INVALID_ATTRIBUTE_FORMAT', severity: 'error',
            message: `Formato inválido en línea de clase '${className}'`, elementId: classId,
            lineNumber: i + 1, location: `Clase '${className}', línea ${i + 1}`,
            details: `Se esperaba '+' o '-' al inicio`
          });
          continue;
        }

        const content = line.substring(1).trim();

        if (content.includes('(')) {
          // Método
          const openParen = content.indexOf('(');
          const closeParen = content.indexOf(')');
          if (openParen === -1 || closeParen === -1 || closeParen <= openParen) {
            errors.push({
              type: 'INVALID_METHOD_FORMAT', severity: 'error',
              message: 'Paréntesis mal formados en método', elementId: classId,
              lineNumber: i + 1, location: `Clase '${className}', línea ${i + 1}`
            });
            continue;
          }
          const methodName = content.substring(0, openParen).trim();
          const returnPart = content.substring(closeParen + 1).trim();
          if (!methodName) {
            errors.push({ type: 'INVALID_METHOD_FORMAT', severity: 'error', message: 'Método sin nombre', elementId: classId, lineNumber: i + 1 });
            continue;
          }
          if (!returnPart.startsWith(':')) {
            errors.push({ type: 'INVALID_METHOD_FORMAT', severity: 'error', message: 'Tipo de retorno incorrecto', elementId: classId, lineNumber: i + 1 });
            continue;
          }
          const returnType = returnPart.substring(1).trim();
          if (!returnType) {
            errors.push({ type: 'INVALID_METHOD_FORMAT', severity: 'error', message: 'Tipo de retorno vacío', elementId: classId, lineNumber: i + 1 });
            continue;
          }
          if (classMethods.has(methodName)) {
            errors.push({ type: 'DUPLICATE_METHOD', severity: 'error', message: `Método '${methodName}' duplicado en clase '${className}'`, elementId: classId, lineNumber: i + 1 });
          } else {
            classMethods.set(methodName, true);
          }
        } else {
          // Atributo
          const parts = content.split(':');
          if (parts.length !== 2) {
            errors.push({ type: 'INVALID_ATTRIBUTE_FORMAT', severity: 'error', message: 'Formato inválido en atributo', elementId: classId, lineNumber: i + 1 });
            continue;
          }
          const name = parts[0].trim();
          const type = parts[1].trim();
          if (!name || !type) {
            errors.push({ type: 'INVALID_ATTRIBUTE_FORMAT', severity: 'error', message: 'Atributo incompleto', elementId: classId, lineNumber: i + 1 });
            continue;
          }
          if (classAttributes.has(name)) {
            errors.push({ type: 'DUPLICATE_ATTRIBUTE', severity: 'error', message: `Atributo '${name}' duplicado en clase '${className}'`, elementId: classId, lineNumber: i + 1 });
          } else {
            classAttributes.set(name, true);
          }
        }
      }
    });

    // Validación de relaciones si no hay errores graves en clases
    const classErrors = errors.filter(e => e.type.includes('CLASS') || e.type === 'INVALID_ATTRIBUTE_FORMAT' || e.type === 'INVALID_METHOD_FORMAT');
    if (classErrors.length === 0) {
      const classIds = new Set(classes.map(c => c.id));
      links.forEach(link => {
        const sourceId = link.source?.id;
        const targetId = link.target?.id;
        if (!sourceId || !classIds.has(sourceId)) {
          errors.push({ type: 'INVALID_RELATIONSHIP', severity: 'error', message: 'Relación apunta a clase inexistente (origen)', elementId: link.id });
          return;
        }
        if (!targetId || !classIds.has(targetId)) {
          errors.push({ type: 'INVALID_RELATIONSHIP', severity: 'error', message: 'Relación apunta a clase inexistente (destino)', elementId: link.id });
          return;
        }

        // Multiplicidades
        if (opts.requireMultiplicities) {
          if (!link.labels || !Array.isArray(link.labels) || link.labels.length === 0) {
            errors.push({ type: 'MISSING_MULTIPLICITY', severity: 'error', message: 'Relación sin multiplicidad', elementId: link.id });
          } else {
            const validMultiplicities = ['1', '0..1', '1..*', '0..*', '*'];
            link.labels.forEach((label) => {
              const multiplicity = label.attrs?.text?.text;
              if (multiplicity && !validMultiplicities.includes(multiplicity.trim())) {
                errors.push({ type: 'INVALID_MULTIPLICITY', severity: 'error', message: `Multiplicidad inválida: '${multiplicity}'`, elementId: link.id });
              }
            });
          }
        }

        // Herencia circular (simplificado)
        if (link.metadata?.relationType === 'inheritance') {
          let current = targetId;
          const visited = new Set();
          while (current && classIds.has(current)) {
            if (current === sourceId) {
              errors.push({ type: 'CIRCULAR_INHERITANCE', severity: 'error', message: 'Herencia circular detectada', elementId: link.id });
              break;
            }
            if (visited.has(current)) break;
            visited.add(current);
            current = null; // No hay grafo completo para seguir la cadena, simplificado
          }
        }
      });
    }

    if (opts.requireRelationships && links.length === 0) {
      errors.push({ type: 'NO_RELATIONSHIPS', severity: 'error', message: 'Se requieren relaciones entre clases' });
    } else if (links.length === 0) {
      warnings.push({ type: 'NO_RELATIONSHIPS', severity: 'warning', message: 'El diagrama no tiene relaciones entre clases' });
    }

    const success = errors.length === 0;
    return {
      success,
      message: success ? 'Diagrama válido' : `El diagrama contiene ${errors.length} error(es)`,
      errors,
      warnings
    };
  } catch (err) {
    return {
      success: false,
      message: 'Error al procesar el diagrama',
      errors: [{ type: 'SERVER_ERROR', severity: 'error', message: err.message }],
      warnings: []
    };
  }
}

module.exports = { validate };
