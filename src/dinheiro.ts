// Conversão entre texto digitado ("12,50") e centavos (1250). Evita erro de arredondamento.

export function formatarReais(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = String(abs % 100).padStart(2, '0');
  return (negativo ? '-' : '') + 'R$ ' + reais + ',' + cents;
}

/**
 * Aceita "12", "12,5", "12,50", "R$ 1.234,56", "12.50".
 * Devolve null quando o texto não é um valor válido.
 */
export function lerReais(texto: string): number | null {
  let t = texto.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ''); // "1.234" = mil duzentos e trinta e quatro
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const [inteiro, frac = ''] = t.split('.');
  return Number(inteiro) * 100 + Number(frac.padEnd(2, '0'));
}
