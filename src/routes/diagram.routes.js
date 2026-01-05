const express = require('express');
const router = express.Router();

// Ruta para validar diagramas UML exportados desde el frontend
router.post('/validate', (req, res) => {
  const { diagram } = req.body;
  if (!diagram) {
    return res.status(400).json({ message: 'No se recibió el diagrama' });
  }

  try {
    // Filtrar solo las clases (rectángulos estándar)
    const elements = diagram.cells.filter(cell => cell.type === 'standard.Rectangle');

    // Extraer el texto de cada clase
    const clases = elements.map(el => el.attrs.label.text);

    // Validar cada clase
    const errores = clases.map((texto) => {
      const nombre = texto.split('\n')[0]; // primera línea = nombre de la clase
      const tieneAtributo = texto.includes('-'); // atributos con prefijo "-"
      const tieneMetodo = texto.includes('+');   // métodos con prefijo "+"

      if (!tieneAtributo || !tieneMetodo) {
        return `Clase "${nombre}" incompleta (atributo o método faltante)`;
      }
      return null;
    }).filter(Boolean);

    // Responder según validación
    if (errores.length > 0) {
      return res.json({ message: 'Errores encontrados:\n' + errores.join('\n') });
    }

    return res.json({ message: `Diagrama válido: ${clases.length} clases encontradas.` });
  } catch (err) {
    return res.status(500).json({ message: 'Error al procesar el diagrama', error: err.message });
  }
});

module.exports = router;
