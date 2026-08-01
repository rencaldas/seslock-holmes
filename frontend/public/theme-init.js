// Aplica o tema salvo antes da primeira pintura, evitando o flash de tema
// errado enquanto o bundle React ainda carrega. Precisa rodar de forma
// síncrona no <head> — por isso não faz parte do bundle.
//
// Vive como arquivo externo em public/ em vez de inline no index.html por
// causa da Content-Security-Policy (ver os headers em vercel.json): um script
// inline exigiria 'unsafe-inline' em script-src (que esvazia boa parte da
// proteção contra XSS) ou um hash sha256 do conteúdo. O hash foi descartado
// porque quebra silenciosamente de duas formas: a cada edição deste script, e
// entre ambientes — o repositório guarda LF, mas checkouts Windows com
// core.autocrlf=true produzem CRLF, e os dois geram hashes distintos.
(function () {
  try {
    var stored = localStorage.getItem("seslock-theme");
    var isDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (error) {
    // Segue com o tema claro padrão se o localStorage estiver indisponível.
  }
})();
