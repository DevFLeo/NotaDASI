# Importação da planilha XLSX (levantamento SIG)

Função: `importacao_de_xlsx()` em [`scripts/importacao_de_xlsx.py`](../scripts/importacao_de_xlsx.py)

## Como usar

```bash
# 1) instalar a dependência (uma vez)
pip install openpyxl

# 2) ver o resumo do que a planilha tem
python scripts/importacao_de_xlsx.py dados/sua_planilha.xlsx

# 3) gerar os dados que o app consome
python scripts/importacao_de_xlsx.py dados/sua_planilha.xlsx --ts src/data/registros.gerado.ts

# opcional: exportar em JSON
python scripts/importacao_de_xlsx.py dados/sua_planilha.xlsx --json dados/saida.json

# opcional: escolher a aba
python scripts/importacao_de_xlsx.py dados/sua_planilha.xlsx --aba "Levantamento"
```

Depois do passo 3, o app usa automaticamente os dados da planilha no lugar dos
dados de exemplo (a troca acontece em `src/data/fonte.ts`).

## Várias abas

Sem `--aba`, o script lê **todas** as abas que tiverem a coluna de competência
(no diagnóstico: SEMUR, SEMFAZ, SEMUSB, SEMA, SEMTRAN). O nome da aba vira o
campo `secretaria` de cada registro. As abas de resumo ("Estrutura interna",
"Página6"...) não viram registros, mas vão inteiras para a tela **Planilha**
com `--abas-ts src/data/planilha.gerado.ts`.

Particularidades da planilha real que o script já trata:

- o cabeçalho "setor" fica mesclado por cima de duas colunas (departamento +
  setor) — ou três na SEMA, com a coordenadoria antes;
- uma competência que usa várias camadas ocupa várias linhas; as de baixo
  trazem só a camada e herdam a competência de cima (um registro por linha);
- a coluna 1° vem escrita "O **sitema** atende..." (sem o s);
- erros de fórmula do Excel (`#DIV/0!`, `#VALUE!`...) viram célula vazia;
- competência sem resposta em "1° O sistema atende" aparece no app como
  **Sem resposta**, não como "Parcial".

## Os problemas que ele resolve sozinho

**1. Células mescladas.** Na planilha, "Departamento" e "Setor" ficam mesclados
por várias linhas — o Excel guarda o valor só na primeira e deixa as outras
vazias. O script desfaz a mesclagem e propaga o valor para baixo, senão toda
competência a partir da segunda linha ficaria órfã.

**2. Responsável embutido no texto.** O nome e o cargo vêm dentro do nome da
unidade, entre parênteses:

```
Divisão de Controle e Informação - DICI (Gerente Damaris Loddoggi Dias Galvão)
```

vira:

| Campo | Valor |
|---|---|
| `setor` | Divisão de Controle e Informação |
| `setorSigla` | DICI |
| `cargo` | Gerente |
| `responsavel` | Damaris Loddoggi Dias Galvão |

> A comparação de cargo é feita pela **palavra inteira**, não por prefixo —
> senão "Diretora Geisa" viraria cargo "Diretor" + nome "a Geisa".

## Colunas reconhecidas

Os cabeçalhos são comparados **sem acento, sem espaço, sem maiúscula e sem
pontuação**, e por prefixo — então "1° O sistema atende a atividade realizada
pelo setor conforme regimento interno?" casa mesmo se a frase mudar no fim.

| Campo | Coluna na planilha |
|---|---|
| `departamento` | Departamento |
| `setor` | setor / divisão / unidade |
| `competencia` | Competência conforme regimento interno |
| `sistemaAtende` | 1° O sistema atende a atividade...? |
| `comoAtende` | 2° O sistema atende de qual forma...? |
| `estruturadoNoSistema` | 3° Já está estruturado no sistema...? |
| `houveTreinamento` | Houve treinamento para execução...? |
| `informacoesAcessadas` | Informações a serem acessadas |
| `nivelAcessoCamada` | Nível de acesso a camada |
| `acessoCamadaConcedido` | Nível de acesso a camada foi concedido? |
| `iniciouAtividade` | Iniciou a atividade junto ao sistema? |
| `moduloSig` | Módulo do SIG a ser aderido |
| `nivelAcessoModulo` | Nível de acesso ao módulo |
| `acessoModuloConcedido` | Nível de acesso ao módulo concedido? |
| `temProblema` | Tem algum problema no SIG que está interferindo no uso? |
| `temChamado` | Tem chamado aberto para relatar o problema? |
| `detalheProblema` | Detalhe o problema |
| `observacao` | Observação |

Coluna que não existir vira campo vazio; coluna desconhecida é ignorada.
Para acrescentar um cabeçalho novo, basta incluí-lo no dicionário `COLUNAS`.

## Conversão de valores

| Na planilha | No app |
|---|---|
| `Sim` | `true` |
| `Não` | `false` |
| `-`, vazio, qualquer outra coisa | `undefined` (mostrado como `—`) |

## Situação calculada

O app resume cada linha em um status, usado para colorir o cartão:

| Status | Regra |
|---|---|
| **Com problema** | `temProblema = Sim` |
| **Pendente** | `sistemaAtende = Não` |
| **Sem resposta** | `sistemaAtende` vazio ou `-` |
| **Aderido** | `sistemaAtende = Sim` **e** `iniciouAtividade = Sim` |
| **Parcial** | atende, mas ainda não começou a usar |

## Sincronia com o app

Os campos da dataclass `Registro` (Python) espelham **exatamente** o tipo
`Registro` em `src/data/registros.ts`. Ao mudar um lado, mude o outro — senão o
arquivo gerado não compila.

## LGPD

A planilha do levantamento não traz contato pessoal. Se você acrescentar
(`contatoPessoal`), o app exibe o dado **borrado**, revelando só com um toque.
O acesso é restrito à DASI e à chefia do departamento.
