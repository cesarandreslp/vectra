/**
 * Un <input type="datetime-local"> manda "2026-10-21T17:00" sin zona. En Vercel
 * el server corre en UTC y `new Date()` lo guardaba 5 h corrido (17:00 UTC = 12:00
 * en Colombia). Colombia es UTC-5 todo el año (sin horario de verano): basta
 * pegarle el offset. Lo que ya trae zona (ISO con Z u offset) pasa igual.
 */
export function fechaColombia(s: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s}-05:00` : s)
}

/** "mié 21 oct, 5:00 p. m." en hora de Colombia — para textos armados en el server. */
export function textoColombia(d: Date): string {
  return d.toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
