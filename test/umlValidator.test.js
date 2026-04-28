const { validate } = require('../src/services/umlValidator');

describe('umlValidator.validate', () => {
  test('devuelve error cuando falta el diagrama', () => {
    const result = validate(undefined);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'MISSING_DIAGRAM')).toBe(true);
  });

  test('error cuando hay menos clases que minClasses', () => {
    const diagram = { cells: [ { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'A' } } } ] };
    const result = validate(diagram, { minClasses: 2 });
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'EMPTY_DIAGRAM')).toBe(true);
  });

  test('duplicado de nombre de clase detectado', () => {
    const diagram = { cells: [
      { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'ClaseX' } } },
      { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'ClaseX' } } }
    ] };
    const result = validate(diagram);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'DUPLICATE_CLASS_NAME')).toBe(true);
  });

  test('nombre de clase inválido', () => {
    const diagram = { cells: [ { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'Invalid Name!' } } }, { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'Other' } } } ] };
    const result = validate(diagram);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'INVALID_CLASS_NAME')).toBe(true);
  });

  test('clase sin nombre', () => {
    const diagram = { cells: [ { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: '' } } }, { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'B' } } } ] };
    const result = validate(diagram);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'MISSING_CLASS_NAME')).toBe(true);
  });

  test('formato inválido de atributo', () => {
    const diagram = { cells: [ { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'C\n- badattribute' } } }, { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'D' } } } ] };
    const result = validate(diagram);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'INVALID_ATTRIBUTE_FORMAT')).toBe(true);
  });

  test('atributo duplicado', () => {
    const diagram = { cells: [ { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'E\n- x:int\n- x:int' } } }, { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'F' } } } ] };
    const result = validate(diagram);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'DUPLICATE_ATTRIBUTE')).toBe(true);
  });

  test('método mal formado detectado', () => {
    const diagram = { cells: [ { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'G\n+ doSomething(\n' } } }, { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'H' } } } ] };
    const result = validate(diagram);
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'INVALID_METHOD_FORMAT')).toBe(true);
  });

  test('requiere relaciones: falla si no hay links', () => {
    const diagram = { cells: [ { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'A' } } }, { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'B' } } } ] };
    const result = validate(diagram, { requireRelationships: true });
    expect(result.success).toBe(false);
    expect(result.errors.some(e => e.type === 'NO_RELATIONSHIPS')).toBe(true);
  });

  test('multiplicidad faltante e inválida', () => {
    const diagram = { cells: [
      { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'A' } } },
      { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'B' } } },
      { id: 'l1', type: 'standard.Link', source: { id: 'c1' }, target: { id: 'c2' }, labels: [], id: 'l1' }
    ] };
    const r1 = validate(diagram, { requireMultiplicities: true });
    expect(r1.success).toBe(false);
    expect(r1.errors.some(e => e.type === 'MISSING_MULTIPLICITY')).toBe(true);

    // invalid multiplicity value
    const diagram2 = { cells: [
      { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'A' } } },
      { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'B' } } },
      { id: 'l2', type: 'standard.Link', source: { id: 'c1' }, target: { id: 'c2' }, labels: [ { attrs: { text: { text: 'invalid' } } } ], id: 'l2' }
    ] };
    const r2 = validate(diagram2, { requireMultiplicities: true });
    expect(r2.success).toBe(false);
    expect(r2.errors.some(e => e.type === 'INVALID_MULTIPLICITY')).toBe(true);
  });

  test('diagrama válido con relación', () => {
    const diagram = { cells: [
      { id: 'c1', type: 'standard.Rectangle', attrs: { label: { text: 'User\n- id:int\n+ getId():int' } } },
      { id: 'c2', type: 'standard.Rectangle', attrs: { label: { text: 'Post\n- id:int\n- authorId:int' } } },
      { id: 'link', type: 'standard.Link', source: { id: 'c1' }, target: { id: 'c2' }, labels: [ { attrs: { text: { text: '1' } } } ] }
    ] };

    const result = validate(diagram);
    expect(result.success).toBe(true);
    expect(result.errors.length).toBe(0);
  });
});
