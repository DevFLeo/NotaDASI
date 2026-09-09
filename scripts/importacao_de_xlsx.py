"""
Importação de XLSX — levantamento de competências e adesão ao SIG.

Lê a planilha do levantamento (Departamento / Setor / Competência / respostas
sobre o SIG) e devolve os registros já limpos, resolvendo os dois problemas que
esse tipo de planilha sempre tem:

1. CÉLULAS MESCLADAS: "Departamento" e "Setor" ficam mesclados por várias
   linhas. O openpyxl devolve o valor só na primeira linha e None nas demais,
   então aqui o valor é propagado para baixo (forward fill).
2. RESPONSÁVEL EMBUTIDO NO TEXTO: o nome e o cargo vêm dentro do próprio nome do
   setor, entre parênteses — ex.: "Divisão de Controle e Informação - DICI
   (Gerente Damaris Loddoggi Dias Galvão)". Aqui isso é separado em campos.

Uso:
    python scripts/importacao_de_xlsx.py planilha.xlsx
    python scripts/importacao_de_xlsx.py planilha.xlsx --aba "Levantamento"
    python scripts/importacao_de_xlsx.py planilha.xlsx --json saida.json
    python scripts/importacao_de_xlsx.py planilha.xlsx --ts src/data/registros.gerado.ts
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any

try:
    from openpyxl import load_workbook
except ImportError:  # pragma: no cover
    print("Falta a biblioteca openpyxl. Instale com:  pip install openpyxl")
    raise SystemExit(1)


# ---------------------------------------------------------------------------
# Modelo
# ---------------------------------------------------------------------------


@dataclass
class Registro:
    """Uma linha do levantamento: uma competência de um setor."""

    id: str

    # Lotação
    departamento: str = ""
    departamentoSigla: str = ""
    departamentoResponsavel: str = ""
    departamentoCargo: str = ""

    setor: str = ""
    setorSigla: str = ""
    responsavel: str = ""
    cargo: str = ""

    # Competência avaliada
    competencia: str = ""

    # Respostas sobre o SIG
    sistemaAtende: bool | None = None
    comoAtende: str = ""
    estruturadoNoSistema: bool | None = None
    houveTreinamento: bool | None = None

    informacoesAcessadas: str = ""
    nivelAcessoCamada: str = ""
    acessoCamadaConcedido: bool | None = None
    iniciouAtividade: bool | None = None

    moduloSig: str = ""
    nivelAcessoModulo: str = ""
    acessoModuloConcedido: bool | None = None

    temProblema: bool | None = None
    temChamado: bool | None = None
    detalheProblema: str = ""
    observacao: str = ""

    # Preenchido depois, se houver planilha de contatos
    contatoInstitucional: dict[str, str] = field(default_factory=dict)
    contatoPessoal: dict[str, str] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Normalização
# ---------------------------------------------------------------------------


def _chave(texto: Any) -> str:
    """Reduz um cabeçalho a letras e números, sem acento — para comparação."""
    if texto is None:
        return ""
    sem_acento = unicodedata.normalize("NFD", str(texto))
    sem_acento = "".join(c for c in sem_acento if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]", "", sem_acento.lower())


def _texto(valor: Any) -> str:
    """Converte a célula em texto limpo. '-' e vazios viram string vazia."""
    if valor is None:
        return ""
    texto = re.sub(r"\s+", " ", str(valor)).strip()
    return "" if texto in {"-", "--", "—", "N/A", "n/a"} else texto


def _booleano(valor: Any) -> bool | None:
    """Sim/Não → True/False. Qualquer outra coisa (inclusive '-') vira None."""
    chave = _chave(valor)
    if chave in {"sim", "s", "true", "1"}:
        return True
    if chave in {"nao", "n", "false", "0"}:
        return False
    return None


# ---------------------------------------------------------------------------
# Cabeçalhos aceitos
# ---------------------------------------------------------------------------

# A comparação é feita por "começa com" sobre a chave normalizada, porque os
# cabeçalhos da planilha são frases longas que podem variar na ponta.
COLUNAS: dict[str, list[str]] = {
    "departamento": ["departamento"],
    "setor": ["setor", "divisao", "unidade"],
    "competencia": ["competencia", "competenciaconformeregimento", "atribuicao"],
    "sistemaAtende": [
        "1osistemaatende",
        "1sistemaatende",
        "osistemaatendeaatividade",
        "sistemaatendeaatividade",
    ],
    "comoAtende": [
        "2osistemaatende",
        "2sistemaatende",
        "osistemaatendedequalforma",
        "sistemaatendedequalforma",
    ],
    "estruturadoNoSistema": [
        "3jaestaestruturado",
        "3ojaestaestruturado",
        "jaestaestruturado",
        "estruturadonosistema",
    ],
    "houveTreinamento": ["houvetreinamento"],
    "informacoesAcessadas": ["informacoesaseremacessadas", "informacoesacessadas"],
    "nivelAcessoCamada": ["niveldeacessoacamada", "nivelacessocamada"],
    "acessoCamadaConcedido": ["niveldeacessoacamadafoiconcedido", "acessocamadaconcedido"],
    "iniciouAtividade": ["iniciouaatividade", "iniciouatividade"],
    "moduloSig": ["modulodosig", "modulosig", "modulo"],
    "nivelAcessoModulo": ["niveldeacessoaomodulo", "nivelacessomodulo"],
    "acessoModuloConcedido": ["niveldeacessoaomoduloconcedido", "acessomoduloconcedido"],
    "temProblema": ["temalgumproblema", "temproblema"],
    "temChamado": ["temchamadoaberto", "temchamado"],
    "detalheProblema": ["detalheoproblema", "detalheproblema"],
    "observacao": ["observacao", "observacoes"],
}

# Campos que devem ser lidos como Sim/Não.
CAMPOS_BOOLEANOS = {
    "sistemaAtende",
    "estruturadoNoSistema",
    "houveTreinamento",
    "acessoCamadaConcedido",
    "iniciouAtividade",
    "acessoModuloConcedido",
    "temProblema",
    "temChamado",
}


def _mapear_colunas(cabecalho: list[Any]) -> dict[str, int]:
    """Descobre em qual coluna está cada campo, comparando por prefixo."""
    chaves = [_chave(celula) for celula in cabecalho]
    mapa: dict[str, int] = {}

    for campo, aceitos in COLUNAS.items():
        for indice, chave in enumerate(chaves):
            if not chave or indice in mapa.values():
                continue
            if any(chave.startswith(aceito) or aceito.startswith(chave) for aceito in aceitos if chave):
                mapa[campo] = indice
                break

    return mapa


# ---------------------------------------------------------------------------
# Extração de responsável ("... - DICI (Gerente Fulana de Tal)")
# ---------------------------------------------------------------------------

CARGOS_CONHECIDOS = [
    "Diretor",
    "Diretora",
    "Gerente",
    "Chefe",
    "Coordenador",
    "Coordenadora",
    "Secretário",
    "Secretária",
    "Responsável",
]

# Do mais longo para o mais curto: evita que "Diretor" vença "Diretora".
CARGOS_CONHECIDOS.sort(key=len, reverse=True)


def separar_unidade(texto_bruto: str) -> tuple[str, str, str, str]:
    """
    Quebra "Divisão de Controle e Informação - DICI (Gerente Damaris Dias)" em:
        (nome_da_unidade, sigla, nome_do_responsavel, cargo)

    Se algum pedaço não existir, volta string vazia — nunca levanta erro.
    """
    texto = _texto(texto_bruto)
    if not texto:
        return "", "", "", ""

    responsavel = ""
    cargo = ""

    # O responsável vem entre parênteses, geralmente precedido do cargo.
    parenteses = re.search(r"\(([^)]*)\)", texto)
    if parenteses:
        conteudo = _texto(parenteses.group(1))
        texto = _texto(texto[: parenteses.start()] + texto[parenteses.end() :])

        # Compara a PRIMEIRA PALAVRA para nao confundir "Diretora" com "Diretor"
        # (o prefixo curto casaria e sobraria um "a" grudado no nome).
        primeira_palavra = conteudo.split(" ")[0] if conteudo else ""
        for possivel in CARGOS_CONHECIDOS:
            if _chave(primeira_palavra) == _chave(possivel):
                cargo = possivel
                responsavel = _texto(conteudo[len(primeira_palavra) :])
                break
        else:
            responsavel = conteudo

    # A sigla vem depois de um hífen, em caixa alta.
    sigla = ""
    hifen = re.split(r"\s[-–]\s", texto)
    if len(hifen) > 1:
        candidata = _texto(hifen[-1])
        if candidata and candidata.upper() == candidata and len(candidata) <= 12:
            sigla = candidata
            texto = _texto(" - ".join(hifen[:-1]))

    return texto, sigla, responsavel, cargo


# ---------------------------------------------------------------------------
# Leitura da planilha
# ---------------------------------------------------------------------------


def _desmesclar(planilha) -> None:
    """
    Copia o valor da célula mesclada para todas as células do intervalo.

    Sem isso, "Departamento" e "Setor" apareceriam só na primeira linha do
    bloco e todas as competências seguintes ficariam órfãs.
    """
    for intervalo in list(planilha.merged_cells.ranges):
        min_col, min_lin, max_col, max_lin = intervalo.bounds
        valor = planilha.cell(row=min_lin, column=min_col).value
        planilha.unmerge_cells(str(intervalo))

        for linha in range(min_lin, max_lin + 1):
            for coluna in range(min_col, max_col + 1):
                planilha.cell(row=linha, column=coluna).value = valor


def _encontrar_linha_cabecalho(linhas: list[tuple], limite: int = 10) -> int:
    """Acha a linha que contém os cabeçalhos (a que mais casa com COLUNAS)."""
    melhor_linha, melhor_placar = 0, 0

    for indice, linha in enumerate(linhas[:limite]):
        placar = len(_mapear_colunas(list(linha)))
        if placar > melhor_placar:
            melhor_linha, melhor_placar = indice, placar

    return melhor_linha


def importacao_de_xlsx(caminho: str | Path, aba: str | None = None) -> list[Registro]:
    """
    Importa a planilha de levantamento e devolve a lista de registros.

    :param caminho: caminho do arquivo .xlsx
    :param aba: nome da aba; se omitido, usa a primeira
    """
    arquivo = Path(caminho)
    if not arquivo.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {arquivo}")

    livro = load_workbook(arquivo, data_only=True)
    planilha = livro[aba] if aba else livro[livro.sheetnames[0]]

    _desmesclar(planilha)

    linhas = list(planilha.iter_rows(values_only=True))
    if not linhas:
        return []

    indice_cabecalho = _encontrar_linha_cabecalho(linhas)
    mapa = _mapear_colunas(list(linhas[indice_cabecalho]))

    if "competencia" not in mapa:
        raise ValueError(
            "Não encontrei a coluna de competência. Cabeçalhos lidos: "
            + ", ".join(str(c) for c in linhas[indice_cabecalho] if c)
        )

    registros: list[Registro] = []
    ultimo_departamento = ""
    ultimo_setor = ""

    for numero, linha in enumerate(linhas[indice_cabecalho + 1 :], start=indice_cabecalho + 2):

        def celula(campo: str) -> Any:
            indice = mapa.get(campo)
            return linha[indice] if indice is not None and indice < len(linha) else None

        competencia = _texto(celula("competencia"))

        # Propaga a lotação para baixo (planilhas costumam repetir só na 1a linha).
        departamento_bruto = _texto(celula("departamento")) or ultimo_departamento
        setor_bruto = _texto(celula("setor")) or ultimo_setor
        ultimo_departamento = departamento_bruto
        ultimo_setor = setor_bruto

        # Linha totalmente vazia: ignora.
        if not competencia and not any(_texto(valor) for valor in linha):
            continue
        if not competencia:
            continue

        dep_nome, dep_sigla, dep_resp, dep_cargo = separar_unidade(departamento_bruto)
        set_nome, set_sigla, set_resp, set_cargo = separar_unidade(setor_bruto)

        registro = Registro(
            id=f"lev-{numero:04d}",
            departamento=dep_nome,
            departamentoSigla=dep_sigla,
            departamentoResponsavel=dep_resp,
            departamentoCargo=dep_cargo,
            setor=set_nome,
            setorSigla=set_sigla,
            responsavel=set_resp,
            cargo=set_cargo,
            competencia=competencia,
        )

        for campo in COLUNAS:
            if campo in {"departamento", "setor", "competencia"}:
                continue

            valor = celula(campo)
            if campo in CAMPOS_BOOLEANOS:
                setattr(registro, campo, _booleano(valor))
            else:
                setattr(registro, campo, _texto(valor))

        registros.append(registro)

    return registros


# ---------------------------------------------------------------------------
# Saídas
# ---------------------------------------------------------------------------


def gerar_json(registros: list[Registro]) -> str:
    return json.dumps([asdict(r) for r in registros], ensure_ascii=False, indent=2)


def gerar_typescript(registros: list[Registro], origem: str) -> str:
    """Gera o arquivo que o app React Native consome."""
    corpo = json.dumps([asdict(r) for r in registros], ensure_ascii=False, indent=2)
    corpo = corpo.replace(": null", ": undefined")

    return (
        "/**\n"
        " * ARQUIVO GERADO AUTOMATICAMENTE — NAO EDITE A MAO.\n"
        " *\n"
        f" * Origem: {origem}\n"
        f" * Registros: {len(registros)}\n"
        f" * Regenerar: python scripts/importacao_de_xlsx.py {origem} --ts src/data/registros.gerado.ts\n"
        " */\n\n"
        "import type { Registro } from './registros';\n\n"
        f"export const registrosImportados: Registro[] = {corpo};\n"
    )


def _resumo(registros: list[Registro]) -> str:
    setores = sorted({r.setorSigla or r.setor for r in registros if r.setorSigla or r.setor})
    atendidas = sum(1 for r in registros if r.sistemaAtende is True)
    nao_atendidas = sum(1 for r in registros if r.sistemaAtende is False)
    com_problema = sum(1 for r in registros if r.temProblema is True)
    sem_chamado = sum(1 for r in registros if r.temProblema is True and r.temChamado is False)

    linhas = [
        f"Registros importados....: {len(registros)}",
        f"Setores.................: {len(setores)} ({', '.join(setores) or '-'})",
        f"Sistema atende..........: {atendidas} sim / {nao_atendidas} não",
        f"Com problema no SIG.....: {com_problema}",
        f"Problema SEM chamado....: {sem_chamado}",
    ]
    return "\n".join(linhas)


def main() -> int:
    analisador = argparse.ArgumentParser(
        description="Importa a planilha XLSX do levantamento de competências / adesão ao SIG.",
    )
    analisador.add_argument("planilha", help="caminho do arquivo .xlsx")
    analisador.add_argument("--aba", help="nome da aba (padrão: a primeira)")
    analisador.add_argument("--json", help="grava a saída em JSON neste caminho")
    analisador.add_argument("--ts", help="grava o arquivo TypeScript do app neste caminho")

    argumentos = analisador.parse_args()

    try:
        registros = importacao_de_xlsx(argumentos.planilha, argumentos.aba)
    except (FileNotFoundError, ValueError) as erro:
        print(f"Erro: {erro}")
        return 1

    if not registros:
        print("Nenhuma linha de competência encontrada na planilha.")
        return 1

    print(_resumo(registros))

    if argumentos.json:
        Path(argumentos.json).write_text(gerar_json(registros), encoding="utf-8")
        print(f"JSON gravado em: {argumentos.json}")

    if argumentos.ts:
        destino = Path(argumentos.ts)
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(
            gerar_typescript(registros, Path(argumentos.planilha).name), encoding="utf-8"
        )
        print(f"TypeScript gravado em: {destino}")

    if not argumentos.json and not argumentos.ts:
        print("\n(nenhuma saída pedida — use --json e/ou --ts para gravar)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
