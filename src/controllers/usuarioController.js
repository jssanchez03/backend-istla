const usuarioRepo = require('../repositories/usuarioRepository');

async function obtenerPerfil(req, res) {
  const { id } = req.params;

  try {
    const datos = await usuarioRepo.obtenerNombreYPerfilPorId(id);
    if (!datos) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(datos);
  } catch (err) {
    console.error("Error al obtener perfil:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
}

module.exports = {
  obtenerPerfil,
};