# Informe Final de Seguridad - EduPath

Fecha de corte: 2026-03-05
Proyecto evaluado: `EduPath-Backend` y `EduPath-Frontend`
Alcance principal: Controles OWASP ASVS Nivel 1 (enfoque practico sobre autenticacion, autorizacion, validacion de entradas, exposicion de datos, dependencias y evidencia automatizada).

## 1. Objetivo del trabajo

Documentar y evidenciar el proceso completo de endurecimiento de seguridad realizado sobre la aplicacion, incluyendo:
- Estado inicial y riesgos identificados.
- Medidas implementadas en codigo.
- Medidas que se intentaron o evaluaron.
- Pruebas ejecutadas y resultado final de seguridad.

## 2. Estado inicial (antes de la remediacion)

Al inicio del proceso se identificaron riesgos criticos y altos, entre ellos:
- Autenticacion debil basada en headers manipulables (`x-persona-id`) y estado de cliente.
- Rutas sensibles expuestas sin control robusto de acceso por rol.
- Validacion y sanitizacion de entradas insuficiente.
- Exposicion potencial de campos sensibles en respuestas de API.
- Ausencia de bateria de pruebas de seguridad automatizadas.
- Ausencia de pipeline CI de seguridad.
- Dependencias con vulnerabilidades High/Critical.

## 3. Estrategia aplicada

Se ejecuto una remediacion por fases:
- Fase 1: Autenticacion/autorizacion y sesiones.
- Fase 2: Validacion de entrada y sanitizacion.
- Fase 3: Pruebas automatizadas, SAST local y CI de seguridad.
- Fase 4: Remediacion de dependencias vulnerables.
- Fase 5: Reduccion adicional de vulnerabilidades moderadas y ajuste fino.

## 4. Controles implementados

### 4.1 Autenticacion y sesiones

Se migro a JWT como mecanismo principal de identidad:
- Utilidad JWT: `src/utils/jwt.js`
- Middleware de autenticacion por Bearer token: `src/middlewares/autenticacionUsuario.js`

Mejoras realizadas:
- Validacion obligatoria de `Authorization: Bearer <token>`.
- Verificacion de token expirado/invalido.
- Resolucion de contexto de usuario autenticado (persona, rol y entidades relacionadas).
- Eliminacion de dependencia de headers inseguros para autenticacion real.

### 4.2 Control de acceso por rol

Se reforzaron middlewares y rutas:
- `src/middlewares/requiereAdmin.js`
- `src/middlewares/requiereDocente.js`
- `src/middlewares/requiereAdminODocente.js`

Rutas criticas protegidas con autenticacion y rol en:
- Administradores, docentes, estudiantes, personas.
- Progreso e informes.
- Respuestas de ejercicios/miniproyectos.
- Gestion de chatbot.

### 4.3 Validacion de entradas y sanitizacion

Se centralizaron controles en:
- `src/utils/inputSecurity.js`

Funciones implementadas:
- Validacion de email.
- Politica minima de password fuerte.
- Sanitizacion de texto plano y rich text.
- Remocion de campos sensibles al responder entidades persona.

Estos controles se integraron en controladores de autenticacion, persona, docente, estudiante y miniproyecto.

### 4.4 Reduccion de exposicion de datos sensibles

Se evito retornar en API:
- `contraseña`
- `resetPasswordTokenHash`
- `resetPasswordExpiresAt`

Se aplico tanto por `attributes.exclude` en consultas Sequelize como por normalizacion de respuesta.

### 4.5 Fortalecimiento de informes (caso admin/docente)

Durante el cierre se corrigio un problema funcional de autorizacion en informes:
- Frontend de reportes ahora envia Bearer token en requests.
- Backend permite acceso a endpoints de reportes para ADMINISTRADOR y DOCENTE donde corresponde.

Archivos:
- `EduPath-Frontend/src/components/ReportsScreen.tsx`
- `src/routes/progreso.routes.js`
- `src/middlewares/requiereAdminODocente.js`

## 5. Dependencias y superficie de ataque

### 5.1 Acciones de remediacion

Se actualizaron dependencias con vulnerabilidades conocidas y/o se reemplazaron paquetes riesgosos:
- Actualizadas: `axios`, `multer`, `@langchain/community`, `puppeteer`.
- Eliminadas/reemplazadas: `xlsx`, `xmldom`, `pg-hstore`, `java-parser`.
- Migracion de lectura Excel a libreria alternativa:
  - `read-excel-file`
  - Refactor en `src/controllers/estudiante.controller.js`

### 5.2 Resultado de auditoria de dependencias

Estado final:
- Sin vulnerabilidades High/Critical en dependencias de produccion con umbral alto.
- Reduccion de moderadas desde 8 hasta 1 residual transitive (`lodash`).

## 6. Pruebas de seguridad realizadas

### 6.1 Pruebas unitarias de seguridad

Runner y tests:
- `node --test`
- `test/inputSecurity.test.js`
- `test/jwt.test.js`

Cobertura funcional de pruebas:
- Validacion de correo.
- Validacion de fortaleza de password.
- Sanitizacion de texto.
- Remocion de campos sensibles.
- Firma y verificacion de JWT.
- Rechazo de token invalido.

Resultado de ejecucion:
- 7/7 pruebas en PASS.

### 6.2 SAST local

Script:
- `scripts/security-sast.js`

Reglas incluidas:
- Uso de `eval`.
- Uso de `new Function`.
- Uso de SQL crudo (`sequelize.query`) para revision.
- Patrones de API keys hardcodeadas.
- Patrones de secretos hardcodeados.

Reporte generado:
- `security-reports/sast-report.json`

Resultado:
- 0 hallazgos High/Critical.

### 6.3 Analisis de dependencias

Comando:
- `npm run security:deps`
- Internamente: `npm audit --omit=dev --audit-level=high`

Resultado:
- PASS para criterio High/Critical.

### 6.4 Pipeline CI de seguridad

Workflow implementado:
- `.github/workflows/security-ci.yml`

Pasos automatizados:
- Instalacion de dependencias.
- `npm run test:security`
- `npm run security:sast`
- `npm run security:deps`
- Publicacion de artefacto SAST.

## 7. Evidencia de ejecucion (comandos usados)

Comando de verificacion integral:

```bash
npm run security:all
```

Definicion actual de scripts en `package.json`:

```json
{
  "test": "node --test",
  "test:security": "node --test test/*.test.js",
  "security:sast": "node scripts/security-sast.js",
  "security:deps": "npm audit --omit=dev --audit-level=high",
  "security:all": "npm run test:security && npm run security:sast && npm run security:deps"
}
```

## 8. Tabla comparativa Antes vs Despues

| Componente | Antes | Accion aplicada | Despues | Evidencia |
| --- | --- | --- | --- | --- |
| Autenticacion | Identidad basada en `x-persona-id` y estado cliente | Migracion a JWT y validacion Bearer token en middleware | Sesion autenticada con token firmado y verificado | `src/utils/jwt.js`, `src/middlewares/autenticacionUsuario.js` |
| Autorizacion por rol | Rutas sensibles con proteccion parcial | Aplicacion de middlewares de rol en rutas criticas | Acceso restringido por rol (`ADMINISTRADOR`, `DOCENTE`, `ESTUDIANTE`) | `src/routes/*.routes.js`, `src/middlewares/requiere*.js` |
| Informes admin/docente | Fallos `401` en reportes por headers heredados y restriccion de rol | Envio de Bearer en frontend + middleware combinado admin/docente | Reportes funcionales para roles autorizados | `EduPath-Frontend/src/components/ReportsScreen.tsx`, `src/middlewares/requiereAdminODocente.js`, `src/routes/progreso.routes.js` |
| Validacion de entrada | Validaciones dispersas e insuficientes | Centralizacion de validadores de email/password/sanitizacion | Rechazo temprano de entradas invalidas y sanitizadas | `src/utils/inputSecurity.js`, controladores `auth/persona/docente/estudiante/miniproyecto` |
| Exposicion de datos sensibles | Riesgo de retorno de hash/token reset en respuestas | Exclusion explicita de campos sensibles + limpieza de respuesta | Menor fuga de informacion sensible en API | `attributes.exclude` en controladores, `removePersonaSensitiveFields` |
| Dependencias vulnerables | Presencia de High/Critical y varias moderadas | Actualizacion, reemplazo y eliminacion de paquetes riesgosos | Sin High/Critical y 1 moderada residual transitive | `package.json`, `package-lock.json`, `SECURITY_TESTING.md` |
| Procesamiento Excel | Dependencia `xlsx/xmldom` con historial de riesgo | Migracion a `read-excel-file` y refactor de importacion | Superficie de ataque reducida en parser de archivos | `src/controllers/estudiante.controller.js` |
| Validacion sintaxis Java | Dependencia adicional (`java-parser`) con transitive vulnerables | Se intento `npm audit fix` no disruptivo y luego refactor para retirar dependencia | Reduccion de vulnerabilidades moderadas asociadas a `chevrotain/lodash-es` | `src/controllers/evaluacion.controller.js`, `SECURITY_TESTING.md` |
| Pruebas de seguridad | Sin baseline automatizado | Suite de pruebas unitarias de seguridad | Verificacion repetible de controles clave | `test/inputSecurity.test.js`, `test/jwt.test.js` |
| SAST y CI | Sin analisis estatico ni pipeline de seguridad | Script SAST local + workflow CI de seguridad | Deteccion automatizada continua de hallazgos de alto impacto | `scripts/security-sast.js`, `.github/workflows/security-ci.yml`, `security-reports/sast-report.json` |

## 9. Riesgo residual y limitaciones

Aunque el estado final es robusto para ASVS L1 practico, quedan elementos fuera de alcance directo de codigo:
- Rotacion formal de secretos en infraestructura externa.
- DAST/pentest con trafico real en entorno staging/produccion.
- Cierre del 100% de moderadas transitive sin cambios potencialmente disruptivos.

Riesgo residual reportado:
- 1 vulnerabilidad moderada transitive (`lodash`) sin impacto High/Critical actual bajo el umbral definido.

## 10. Conclusiones

Resultado final del trabajo de seguridad:
- Se corrigieron debilidades criticas de autenticacion y control de acceso.
- Se incorporaron controles de validacion y sanitizacion en backend.
- Se redujo significativamente la exposicion de datos sensibles.
- Se establecio una base de pruebas de seguridad reproducible.
- Se habilito CI de seguridad para evidencia continua.
- Se elimino el estado de vulnerabilidades High/Critical en dependencias de produccion (criterio de aceptacion principal).

En terminos de evidencia para tesis, la aplicacion queda con un baseline de seguridad verificable, automatizado y trazable por artefactos y reportes.

## 11. Anexos recomendados para la tesis

Se recomienda anexar directamente estos archivos como evidencia primaria:
- `SECURITY_TESTING.md`
- `INFORME_SEGURIDAD_FINAL.md`
- `.github/workflows/security-ci.yml`
- `scripts/security-sast.js`
- `security-reports/sast-report.json`
- `test/inputSecurity.test.js`
- `test/jwt.test.js`
