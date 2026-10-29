// Guarda el resultado para la pestaña de Vectra y cierra la de la Registraduría.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.tipo !== 'censo' || typeof msg.texto !== 'string') return
  chrome.storage.local.set({ censo: { texto: msg.texto.slice(0, 5000), en: Date.now() } })
  if (sender.tab?.id !== undefined) chrome.tabs.remove(sender.tab.id)
})
