import { registrosExemplo, type Registro } from '../../../src/data/registros';
import { registrosImportados } from '../../../src/data/registros.gerado';

/**
 * Mesma ideia do src/data/fonte.ts do app mobile, porem com import estatico
 * (o Vite trabalha com ESM; require() nao existe no navegador).
 *
 * Se a planilha ja foi importada, registros.gerado.ts tem conteudo e ele vence.
 */
const temPlanilha = Array.isArray(registrosImportados) && registrosImportados.length > 0;

export const registros: Registro[] = temPlanilha ? registrosImportados : registrosExemplo;

export const origemDados: 'planilha' | 'exemplo' = temPlanilha ? 'planilha' : 'exemplo';
