const enviarCorreoBienvenida = require('./enviarCorreoBienvenida');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function esErrorTransitorioCorreo(error) {
  const mensaje = String(error?.message || '').toLowerCase();
  return (
    mensaje.includes('timeout') ||
    mensaje.includes('connection') ||
    mensaje.includes('econnreset') ||
    mensaje.includes('etimedout')
  );
}

async function enviarConReintento(payload, maxIntentos = 3) {
  for (let intento = 1; intento <= maxIntentos; intento += 1) {
    try {
      await enviarCorreoBienvenida(payload);
      return;
    } catch (error) {
      const ultimoIntento = intento === maxIntentos;
      const reintentable = esErrorTransitorioCorreo(error);

      if (!reintentable || ultimoIntento) {
        throw error;
      }

      const esperaMs = intento * 3000;
      console.warn(`Reintentando correo a ${payload.email}. Intento ${intento + 1}/${maxIntentos} en ${esperaMs}ms...`);
      await delay(esperaMs);
    }
  }
}

module.exports = async (estudiantes) => {
  for (const item of estudiantes) {
    try {
      const {
        email,
        nombre,
        codigoEstudiantil,
        password
      } = item;

      if (!email || !codigoEstudiantil || !password) {
        console.error("❌ Datos incompletos para correo:", item);
        continue;
      }

      console.log("📤 Enviando correo a:", email);

      await enviarConReintento({
        email,
        nombre,
        codigoEstudiantil,
        password
      });

      console.log("✅ Correo enviado a:", email);

      await delay(5000); // ⏱️ pausa entre correos
    } catch (error) {
      console.error("🔥 Error enviando correo:", {
        email: item?.email || null,
        message: error.message,
        code: error.code || null,
        responseCode: error.responseCode || null,
      });
    }
  }
};
