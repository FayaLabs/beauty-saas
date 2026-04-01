/**
 * Translate label at config time (outside React).
 * Reads persisted locale from localStorage. Falls back to en.
 */
export function tl(en: string, ptBR: string): string {
  try {
    const locale = localStorage.getItem('saas-core:locale') ?? 'pt-BR'
    return locale === 'pt-BR' ? ptBR : en
  } catch { return en }
}
