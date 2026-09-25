import { defineConfig } from "vite";

// Rutas relativas: el build funciona igual en la raíz de un dominio que en
// una subcarpeta (por ejemplo GitHub Pages en /sprites/).
export default defineConfig({
  base: "./",
});
