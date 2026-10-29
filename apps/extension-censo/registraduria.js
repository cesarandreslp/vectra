// En la página oficial, solo si la abrió Vectra (#vectra). No llena ni envía
// nada: la persona pega la cédula y da "Consultar"; esto lee lo que la página
// le muestra y se lo pasa a Vectra.
if (location.hash === '#vectra') {
  const caja = document.getElementById('resultContent')
  const listo = () => caja && (caja.querySelector('.result-table') || caja.querySelector('.aviso-novedad'))
  let enviado = false
  if (caja) {
    new MutationObserver(() => {
      if (enviado || !listo()) return
      enviado = true
      chrome.runtime.sendMessage({ tipo: 'censo', texto: caja.innerText })
    }).observe(caja, { childList: true, subtree: true })
  }
}
