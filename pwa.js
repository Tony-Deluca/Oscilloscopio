"use strict";
// Registra il service worker quando la pagina è servita via http(s).
if ("serviceWorker" in navigator && location.protocol.startsWith("http"))
  navigator.serviceWorker.register("sw.js").catch(() => {});
