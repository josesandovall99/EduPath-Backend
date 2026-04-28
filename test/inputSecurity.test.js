const {
  isNonEmptyString,
  isValidEmail,
  isStrongPassword,
  sanitizePlainText,
  sanitizeRichText,
  removePersonaSensitiveFields,
} = require('../src/utils/inputSecurity');

describe('Validadores y sanitizadores (inputSecurity)', () => {
  describe('isNonEmptyString', () => {
    test('retorna false para valores vacíos o no string', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });

    test('retorna true para strings con contenido', () => {
      expect(isNonEmptyString('hola')).toBe(true);
      expect(isNonEmptyString('  texto ')).toBe(true);
    });
  });

  describe('isValidEmail', () => {
    test('valida emails correctos', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail(' user+alias@sub.dom.com ')).toBe(true);
    });

    test('rechaza emails inválidos o vacíos', () => {
      expect(isValidEmail('sin-arroba')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('isStrongPassword', () => {
    test('acepta contraseñas que cumplen requisitos', () => {
      expect(isStrongPassword('Abcdef12')).toBe(true);
      expect(isStrongPassword('Qwerty9Z')).toBe(true);
    });

    test('rechaza contraseñas débiles', () => {
      expect(isStrongPassword('short1A')).toBe(false); // menos de 8
      expect(isStrongPassword('alllowercase1')).toBe(false); // sin mayúscula
      expect(isStrongPassword('ALLUPPERCASE1')).toBe(false); // sin minúscula
      expect(isStrongPassword('NoDigitsHere')).toBe(false); // sin dígitos
      expect(isStrongPassword('')).toBe(false);
    });
  });

  describe('sanitizePlainText', () => {
    test('elimina caracteres <> y hace trim', () => {
      expect(sanitizePlainText('<script>hola</script> ')).toBe('scripthola/script');
      expect(sanitizePlainText('  texto <b>hola</b> ')).toBe('texto bhola/b');
    });

    test('retorna cadena vacía para valores no válidos', () => {
      expect(sanitizePlainText(null)).toBe('');
      expect(sanitizePlainText('')).toBe('');
    });
  });

  describe('sanitizeRichText', () => {
    test('remueve etiquetas <script> y handlers inline', () => {
      const entrada = `Hola <script>alert('x')</script> <div onclick="do()">Click</div>`;
      const salida = sanitizeRichText(entrada);
      expect(salida).toMatch(/Hola/);
      expect(salida).not.toMatch(/script/);
      expect(salida).not.toMatch(/onclick/);
    });

    test('remueve javascript: y atributos on* incluso con comillas simples', () => {
      const entrada = `<a href="javascript:evil()" onmouseover='bad()'>link</a>`;
      const salida = sanitizeRichText(entrada);
      expect(salida).toMatch(/link/);
      expect(salida).not.toMatch(/javascript:/i);
      expect(salida).not.toMatch(/onmouseover/);
    });

    test('retorna cadena vacía para valores no válidos', () => {
      expect(sanitizeRichText(null)).toBe('');
      expect(sanitizeRichText('')).toBe('');
    });
  });

  describe('removePersonaSensitiveFields', () => {
    test('elimina campos sensibles de un objeto plano', () => {
      const persona = {
        id: 1,
        nombre: 'Juan',
        contraseña: 'secreta',
        resetPasswordTokenHash: 'hash',
        resetPasswordExpiresAt: 'fecha',
        email: 'a@b.com'
      };

      const limpio = removePersonaSensitiveFields(persona);
      expect(limpio.contraseña).toBeUndefined();
      expect(limpio.resetPasswordTokenHash).toBeUndefined();
      expect(limpio.resetPasswordExpiresAt).toBeUndefined();
      expect(limpio.email).toBe('a@b.com');
      expect(limpio.id).toBe(1);
    });

    test('funciona con objeto que tiene toJSON (simula Sequelize)', () => {
      const personaModel = {
        toJSON() {
          return {
            id: 2,
            nombre: 'Ana',
            contraseña: 'otra',
            resetPasswordTokenHash: 'x',
            resetPasswordExpiresAt: 'y'
          };
        }
      };

      const limpio = removePersonaSensitiveFields(personaModel);
      expect(limpio.contraseña).toBeUndefined();
      expect(limpio.id).toBe(2);
      expect(limpio.nombre).toBe('Ana');
    });

    test('retorna el valor original si es falsy', () => {
      expect(removePersonaSensitiveFields(null)).toBeNull();
      expect(removePersonaSensitiveFields(undefined)).toBeUndefined();
    });
  });
});