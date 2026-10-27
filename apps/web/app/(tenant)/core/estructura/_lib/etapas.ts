import type { Etapa } from '../actions-prospectos'

/** Etapas del embudo de la lista de los 100, en orden. */
export const ETAPAS: { key: Etapa; label: string; color: string }[] = [
  { key: 'CANDIDATO',  label: 'Candidato a líder', color: '#64748b' },
  { key: 'CONVERSADO', label: 'Conversado',        color: '#1e40af' },
  { key: 'ACEPTO',     label: 'Aceptó',            color: '#15803d' },
  { key: 'NO_ACEPTO',  label: 'No aceptó',         color: '#b91c1c' },
]

interface Fechas { conversadoEn: Date | null; decididoEn: Date | null }

/**
 * Fechas al pasar de `antes` a `etapa`: cada paso guarda cuándo se dio la
 * primera vez; devolver a una etapa anterior borra las posteriores.
 */
export function fechasEtapa(antes: Fechas & { etapa: Etapa }, etapa: Etapa, ahora: Date): Fechas {
  const decide = etapa === 'ACEPTO' || etapa === 'NO_ACEPTO'
  return {
    conversadoEn: etapa === 'CANDIDATO' ? null : (antes.conversadoEn ?? ahora),
    decididoEn:   !decide ? null : antes.etapa === etapa ? antes.decididoEn : ahora,
  }
}
