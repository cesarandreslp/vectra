// En Vectra: entrega el resultado a la página (que lo valida y guarda) y lo borra.
chrome.storage.onChanged.addListener((cambios, area) => {
  const censo = area === 'local' && cambios.censo?.newValue
  if (!censo || Date.now() - censo.en > 5 * 60_000) return
  window.postMessage({ tipo: 'vectra-censo', texto: censo.texto }, location.origin)
  chrome.storage.local.remove('censo')
})
