import { registrosExemplo, type Registro } from './registros';

/**
 * Fonte unica dos registros exibidos no app.
 *
 * Se voce ja rodou `npm run importar-csv`, o arquivo registros.gerado.ts existe
 * e os dados reais da planilha sao usados. Caso contrario, caimos nos dados de
 * exemplo para o app continuar funcionando.
 */
let registros: Registro[] = registrosExemplo;
let origemDados: 'planilha' | 'exemplo' = 'exemplo';

try {
  const gerado = require('./registros.gerado');
  if (Array.isArray(gerado?.registrosImportados) && gerado.registrosImportados.length > 0) {
    registros = gerado.registrosImportados;
    origemDados = 'planilha';
  }
} catch {
  // Arquivo gerado ainda nao existe — segue com os dados de exemplo.
}

export const carregarRegistros = (): Registro[] => registros;

export const obterOrigemDados = (): 'planilha' | 'exemplo' => origemDados;
