/**
 * Un <input type="datetime-local"> manda "2026-10-21T17:00" sin zona. En Vercel
 * el server corre en UTC y `new Date()` lo guardaba 5 h corrido (17:00 UTC = 12:00
 * en Colombia). Colombia es UTC-5 todo el año (sin horario de verano): basta
 * pegarle el offset. Lo que ya trae zona (ISO con Z u offset) pasa igual.
 */
export function fechaColombia(s: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s}-05:00` : s)
}
