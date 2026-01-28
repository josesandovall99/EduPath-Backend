const express = require('express');
const router = express.Router();
const umlValidator = require('../services/umlValidator');

/**
 * Validador de Diagramas UML
 * POST /diagrams/validate
 */
router.post('/validate', (req, res) => {
  const { diagram, options } = req.body || {};
  const result = umlValidator.validate(diagram, options);
  return res.status(result.success ? 200 : 400).json(result);
});

module.exports = router;
