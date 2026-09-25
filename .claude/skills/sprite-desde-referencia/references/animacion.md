# Animación por regiones

- Todo son **desplazamientos enteros** de regiones (`composeRows`): nada se
  rota ni se escala; tras mover, `closeOutline`.
- Una región que baja tapa la fila de debajo y no deja huecos: respirar y
  pisar **bajan** el cuerpo en vez de subirlo.
- Caminar: 8 fotogramas a 12 fps; cabeza y cola llegan un fotograma tarde.
  Asentado al parar (`SETTLE_MS`).
- Reposo: respiración de 4 tiempos, cola y parpadeo con periodos distintos
  (que no coincidan nunca en fase).
- Acciones: anticipación → acción → impacto → recuperación.
- Saltos en arco (`jumpArc`), redondeado a entero al pintar.
- El bucle va a 60 Hz; la **pose** cambia a 6-12 fps.
- Respeta `prefers-reduced-motion`: pose fija o transiciones mínimas.
