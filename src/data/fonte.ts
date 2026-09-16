import { registrosImportados } from './registros.gerado';
import { registrosExemplo, type Registro } from './registros';

/**
 * Fonte unica dos registros exibidos no app.
 *
 * Usa os dados reais gerados da planilha (registros.gerado.ts, produzido por
 * `npm run importar-xlsx`). Se esse arquivo ainda estiver vazio, caimos nos
 * dados de exemplo para o app continuar funcionando.
 *
 * IMPORTANTE: este import precisa ser estatico (ESM), nao `require()`.
 * O `require` funciona no Metro (Android) mas nao existe no bundle do
 * navegador — no alvo PC ele lancava, o catch engolia o erro em silencio e o
 * app caia nos 5 registros de exemplo em vez das competencias da planilha.
 * Import estatico funciona nos dois alvos e mantem a base identica em ambos.
 */
const temDadosDaPlanilha =
  Array.isArray(registrosImportados) && registrosImportados.length > 0;

const registros: Registro[] = temDadosDaPlanilha ? registrosImportados : registrosExemplo;

const origemDados: 'planilha' | 'exemplo' = temDadosDaPlanilha ? 'planilha' : 'exemplo';

export const carregarRegistros = (): Registro[] => registros;

export const obterOrigemDados = (): 'planilha' | 'exemplo' => origemDados;
