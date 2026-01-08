const enviarCorreoBienvenida = require('./enviarCorreoBienvenida');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

      await enviarCorreoBienvenida({
        email,
        nombre,
        codigoEstudiantil,
        password
      });

      console.log("✅ Correo enviado a:", email);

      await delay(5000); // ⏱️ pausa entre correos
    } catch (error) {
      console.error("🔥 Error enviando correo:", error.message);
    }
  }
};
