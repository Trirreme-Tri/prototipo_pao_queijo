// Ajudantes sem dependência do navegador.

let contador = 0;
export function novoId(): string {
  contador += 1;
  return Date.now().toString(36) + '-' + contador.toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

/** Arredonda quantidade para 3 casas (gramas, mililitros). */
export function q3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Preço × quantidade, arredondado ao centavo. */
export function valorItem(precoUnit: number, quantidade: number): number {
  return Math.round(precoUnit * quantidade);
}

export function falha(mensagem: string): never {
  throw new Error(mensagem);
}

export function exigirQuantidade(q: number, unidade: 'un' | 'kg' | 'l', permitirZero = false): number {
  if (!Number.isFinite(q) || (permitirZero ? q < 0 : q <= 0)) falha(permitirZero ? 'Quantidade não pode ser negativa.' : 'Quantidade precisa ser maior que zero.');
  if (q > 1_000_000) falha('Quantidade grande demais.');
  if (unidade === 'un' && !Number.isInteger(q)) falha('Produto vendido por unidade: use número inteiro.');
  return q3(q);
}

export function exigirCentavos(v: number, permitirZero = true): number {
  if (!Number.isInteger(v) || v < 0 || (!permitirZero && v === 0)) falha(permitirZero ? 'Valor inválido.' : 'O valor precisa ser maior que zero.');
  if (v > 100_000_000) falha('Valor grande demais.');
  return v;
}

export function exigirTexto(t: string, nomeCampo: string, max = 80): string {
  const s = t.trim();
  if (!s) falha(`Preencha ${nomeCampo}.`);
  if (s.length > max) falha(`${nomeCampo[0].toUpperCase() + nomeCampo.slice(1)} pode ter no máximo ${max} letras.`);
  return s;
}

// ---------- Datas (sempre no fuso do aparelho) ----------

const p2 = (n: number) => String(n).padStart(2, '0');

export function chaveDoDia(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function diaDoIso(iso: string): string {
  return chaveDoDia(new Date(iso));
}

export function horaCurta(iso: string): string {
  const d = new Date(iso);
  return p2(d.getHours()) + ':' + p2(d.getMinutes());
}

export function dataCurta(isoOuDia: string): string {
  const [a, m, d] = (isoOuDia.length === 10 ? isoOuDia : chaveDoDia(new Date(isoOuDia))).split('-');
  return `${d}/${m}/${a}`;
}

export function dataHora(iso: string): string {
  return dataCurta(iso) + ' ' + horaCurta(iso);
}

/** Soma dias a uma chave AAAA-MM-DD. */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return chaveDoDia(new Date(a, m - 1, d + n));
}

export function formatarQuantidade(q: number, unidade: string): string {
  const texto = Number.isInteger(q) ? String(q) : q.toFixed(3).replace(/0+$/, '').replace('.', ',');
  return texto + ' ' + unidade;
}
