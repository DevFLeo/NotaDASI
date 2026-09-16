# TUTORIAL — baixar e configurar o NotaDASI

<<<<<<< Updated upstream
Só os comandos. Para entender o código, veja [GUIA-DE-CODIGO.md](GUIA-DE-CODIGO.md);
para a visão geral do projeto, o [README.md](README.md).

---

## 1. Baixar
=======
Guia completo de manutenção do app: **o que cada função faz**, **onde mexer** para mudar tamanhos e imagens, e **o que melhorar** no futuro.

Este documento assume que você já leu o `README.md` (visão geral e diagramas de arquitetura).

## Índice

1. [Como o app se organiza](#1-como-o-app-se-organiza)
2. [Referência de todas as funções](#2-referência-de-todas-as-funções)
3. [Onde mexer em TAMANHOS](#3-onde-mexer-em-tamanhos)
4. [Onde mexer em IMAGENS](#4-onde-mexer-em-imagens)
5. [Reduzindo o tamanho do APK (75 MB → ~15 MB)](#5-reduzindo-o-tamanho-do-apk)
6. [Onde reescrever com segurança](#6-onde-reescrever-com-segurança)
7. [Roteiro de melhorias futuras](#7-roteiro-de-melhorias-futuras)
8. [Receitas rápidas](#8-receitas-rápidas)
9. [Versão web: mapa melhorado + documentos](#9-versão-web-mapa-melhorado--documentos)

---

## 1. Como o app se organiza

Três blocos, com uma regra simples de dependência: **as telas dependem dos dados, nunca o contrário.**

```mermaid
flowchart LR
    A["Dados<br/>registros.ts · fonte.ts"] --> B["Lógica<br/>layout.ts · posicoes.ts · NotaBuscaRapida.ts"]
    B --> C["Telas<br/>ListaRegistros · MapaMental · DetalheRegistro"]
    C --> D["App.tsx<br/>orquestra as abas"]
```

**Regra de ouro:** se você precisa mudar *o que aparece*, mexa em `data/`. Se precisa mudar *como aparece*, mexa nos `StyleSheet.create` dos componentes. Se precisa mudar *como se calcula*, mexa em `mapa/layout.ts` ou no C++.

> Existe uma **quarta peça**, a versão web (`web/`, aberta com `npm run dev`): ela reaproveita `src/data/` inteiro e tem o seu próprio mapa mental — quatro níveis, modo foco e documentos alocados a divisões/pessoas. Veja a [seção 9](#9-versão-web-mapa-melhorado--documentos).

---

## 2. Referência de todas as funções

### 📄 `src/data/registros.ts` — Tipos e regras de negócio

O coração do modelo. Define o que é um registro e as regras derivadas dele.

| Função / constante | Assinatura | O que faz |
|---|---|---|
| `Registro` | `type` | O registro de UMA competência de um setor: lotação, competência avaliada, respostas sobre o SIG, acessos e contatos. Campos `boolean?` opcionais significam **"não respondido"** (o `-` da planilha) — por isso são `?` e não `false`. |
| `Contato` | `type` | `{ email?, telefone?, ramal? }`. |
| `SituacaoAdesao` | `type` | União: `'aderido' \| 'parcial' \| 'pendente' \| 'problema'`. |
| `rotuloSituacao` | `Record<SituacaoAdesao, string>` | Texto exibido no selo: "Aderido", "Parcial", "Pendente", "Com problema". |
| `corPorSituacao` | `Record<SituacaoAdesao, string>` | Cor hex de cada situação. **Alterar aqui muda a cor em TODA a UI** (cartão, selo, nó do mapa). |
| `calcularSituacao(registro)` | `→ SituacaoAdesao` | Resume o registro em um status único. Ordem de precedência: `temProblema` → `problema`; `sistemaAtende === false` → `pendente`; atende **e** `iniciouAtividade` → `aderido`; senão → `parcial`. |
| `textoPesquisavel(registro)` | `→ string` | Concatena 11 campos (responsável, cargo, setor, siglas, departamento, competência, módulo, camada, observação) num único texto que a busca varre. **Para tornar um campo novo pesquisável, adicione-o a este array.** |
| `registrosExemplo` | `Registro[]` | 5 registros fictícios no formato real, usados quando a planilha ainda não foi importada. |

> ⚠️ Os campos de `Registro` espelham a dataclass do `scripts/importacao_de_xlsx.py`. Mudou um lado? Mude o outro.

---

### 📄 `src/data/documentos.ts` — Documento alocado a divisão ou pessoa

TypeScript puro (sem React Native, sem DOM) **de propósito**: hoje quem usa é a versão web, mas o app mobile adota o mesmo arquivo trocando só o armazenamento.

A ideia central: um documento **não pertence a uma competência**, pertence a um **alvo** — `departamento`, `divisao` ou `pessoa`. É o mesmo critério do mundo real (a portaria é da divisão; a ficha de treinamento é da pessoa).

| Função / constante | Assinatura | O que faz |
|---|---|---|
| `Documento` | `type` | `id`, `titulo`, `tipo`, `alvoTipo`, `alvoId`, `alvoRotulo`, `descricao?`, `url?`, `arquivo*?`, `criadoEm`. O `alvoRotulo` é guardado junto **de propósito**: se a planilha mudar a sigla, o documento continua legível. |
| `TipoDocumento` | `type` | `oficio \| portaria \| ata \| manual \| planilha \| mapa \| outro`. |
| `TipoAlvo` | `type` | `departamento \| divisao \| pessoa`. |
| `rotuloTipoDocumento` / `iconeTipoDocumento` / `rotuloTipoAlvo` | `Record<…, string>` | Texto e emoji exibidos. Mudar aqui propaga para o painel, o nó do mapa e o modal. |
| `normalizarChave(texto)` | `→ string` | Tira acento (`NFD` + `\p{Diacritic}`), baixa a caixa e troca o que não é `a-z0-9` por `-`. É o que transforma "Damaris Loddoggi Dias Galvão" em `damaris-loddoggi-dias-galvao`. |
| `idDaDivisao` / `idDaPessoa` / `idDoDepartamento` | `(registro) → string` | Derivam o id do alvo a partir de `setorSigla`, `responsavel` e `departamentoSigla`. **São a cola entre o documento e a planilha** — não existe tabela de pessoas separada. |
| `listarAlvos(registros)` | `→ AlvoDisponivel[]` | Varre os registros e monta a lista do seletor "Alocado a", ordenada por departamento → divisão → pessoa, sem repetição. |
| `chaveAlvo(tipo, id)` | `→ string` | `"divisao:dici"`. Chave única usada nos índices e no botão `+ 📎` do mapa. |
| `documentosDoAlvo` / `agruparPorAlvo` | — | Consultas prontas para a UI. |
| `validarDocumento(parcial)` | `→ string[]` | Lista de erros (vazia = válido): exige título, alvo e **pelo menos um** entre arquivo e link; recusa arquivo acima de 2 MB. |
| `LIMITE_ARQUIVO_BYTES` | `2 * 1024 * 1024` | Teto do anexo embutido em base64. Acima disso, o campo certo é o link. |
| `formatarTamanho(bytes)` | `→ string` | `"318 KB"`. |
| `novoId()` | `→ string` | `doc-<base36 do tempo>-<aleatório>`. |

> ⚠️ `idDaPessoa` usa o **nome** como identidade. Duas pessoas homônimas no levantamento viram o mesmo alvo. Se isso acontecer, o caminho é trocar por matrícula na planilha e nesta função.

---

### 📄 `src/data/fonte.ts` — Origem dos dados

Camada de indireção com uma responsabilidade só: decidir entre dados reais e de exemplo.

| Função | Assinatura | O que faz |
|---|---|---|
| `carregarRegistros()` | `→ Registro[]` | Devolve os registros ativos. Na carga do módulo, tenta `require('./registros.gerado')`; se existir e tiver itens, usa os dados da planilha; senão cai em `registrosExemplo`. |
| `obterOrigemDados()` | `→ 'planilha' \| 'exemplo'` | Diz de onde vieram os dados. A `ListaRegistros` usa isso para mostrar "· dados de exemplo" no subtítulo. |

**Por que um `try/catch` em volta de um `require`?** Porque `registros.gerado.ts` é opcional — só existe depois de rodar o importador. O `catch` vazio é intencional.

---

### 📄 `src/native/NotaBuscaRapida.ts` — Ponte com o C++

Garante que a busca **nunca quebre**, mesmo sem a biblioteca nativa.

| Função | Assinatura | O que faz |
|---|---|---|
| `normalizarTexto(texto)` | `→ string` | Remove acentos (`NFD` + regex de diacríticos) e passa para minúsculas. **Precisa produzir o mesmo resultado que `nota_dasi::normalizarTexto` no C++.** |
| `buscarOcorrenciasEmJs(texto, termo)` | `→ number[]` *(privada)* | Fallback: `indexOf` em laço, devolvendo todas as posições. Avança `posicao + termo.length` para não achar sobreposições. |
| `descriptografarSimuladoEmJs(texto)` | `→ string` *(privada)* | Fallback: desloca cada char code em −3. |
| `NotaBuscaRapida.buscarOcorrencias(texto, termo)` | `→ Promise<number[]>` | **API pública.** Tenta o módulo nativo; em qualquer erro (ou ausência), cai silenciosamente no fallback JS. |
| `NotaBuscaRapida.descriptografarSimulado(texto)` | `→ Promise<string>` | Mesmo padrão de fallback. |

**Padrão importante:** o módulo nativo só é buscado em `Platform.OS === 'android'`. No iOS, `moduloNativo` é `undefined` e o fallback assume — por isso o app funciona nas duas plataformas sem `#ifdef` espalhado pela UI.

---

### 📄 `src/components/ListaRegistros.tsx` — Tela de lista

| Função / componente | O que faz |
|---|---|
| `registroCorresponde(registro, termo)` | `async → boolean`. Chama `NotaBuscaRapida.buscarOcorrencias` sobre o `textoPesquisavel` e devolve `true` se houver ≥ 1 ocorrência. |
| `resumir(texto, limite = 130)` | Trunca com `...` sem cortar espaço no fim (`trimEnd`). Usado no título da competência (130) e no "como atende" (110). |
| `<Indicador rotulo valor>` | Selo Sim/Não/— com cor verde/vermelha/cinza. Trata `undefined` como "—" (não respondido). |
| `<CartaoRegistro registro indice aoSelecionar>` | O cartão. Entra com `FadeInUp` escalonado (`delay = min(indice, 8) * 60` ms — o teto de 8 evita que o item 50 demore 3 s para aparecer) e usa `LinearTransition` para reordenar suavemente. |
| `executarBusca(termo)` | `useCallback` async. Se o termo é vazio, limpa o filtro (`null`); senão roda `Promise.all` sobre todos os registros e guarda os IDs que casaram. |
| `useEffect` do debounce | Aguarda **250 ms** após a última tecla antes de buscar. Cancela com `clearTimeout` no cleanup. |
| `visiveis` (`useMemo`) | Interseção de dois filtros: o da busca (`idsCorrespondentes`) e o do chip de setor (`setorFiltro`). `null` em qualquer um significa "sem filtro". |
| `setores` (`useMemo`) | Lista única e ordenada de siglas, para os chips. |
| `renderizar` | `renderItem` da `FlatList`, memoizado para não recriar a função a cada render. |

---

### 📄 `src/components/BarraBusca.tsx` — Campo de busca

Componente controlado e sem estado próprio: recebe `valor`, `aoAlterar` e `aoPesquisar`. O botão "Buscar" força a busca imediata (contornando o debounce).

---

### 📄 `src/components/DetalheRegistro.tsx` — Modal de detalhe

| Função / componente | O que faz |
|---|---|
| `simNao(valor?)` | `true → "Sim"`, `false → "Não"`, `undefined → "—"`. |
| `rotularUnidade(sigla, nome)` | Junta como `"DICI — Divisão de Controle e Informação"`, ignorando partes vazias. |
| `<Secao titulo>` | Cabeçalho de seção (azul claro, maiúsculas). |
| `<Campo rotulo valor>` | Par rótulo/valor empilhado. |
| `<DetalheRegistro registro aoFechar>` | `Modal` deslizante. Retorna `null` se `registro` for `null` — é assim que o App controla abrir/fechar. Organiza os campos em 5 seções: Lotação, Atendimento pelo SIG, Camadas, Módulo, Problemas. |

---

### 📄 `src/components/ContatoProtegido.tsx` — Dado sensível

| Função | O que faz |
|---|---|
| `mascarar(texto)` | Troca letras e dígitos por `•`, **preservando pontuação e tamanho** (`(69) 9••••-••••`). |
| `<ContatoProtegido contato>` | Mostra mascarado; toque alterna revelar/ocultar. Retorna `null` se não houver e-mail nem telefone. Tem `accessibilityLabel` descritivo. |

**Motivação:** o acesso é liberado para a DASI e a chefia, mas o borrão evita exposição acidental em tela compartilhada/projetada.

---

### 📄 `src/mapa/layout.ts` — Motor do mapa mental

| Função / constante | O que faz |
|---|---|
| `TipoNo` | `'raiz' \| 'setor' \| 'competencia'`. |
| `NoMapa` | Nó posicionado: id, tipo, rótulo, subtítulo, pai, `x/y`, `largura/altura`, cor e o `Registro` de origem (só em competências). |
| `LigacaoMapa` | `{ id, origemId, destinoId }` — uma aresta. |
| `LARGURA_*` / `ALTURA_*` | Dimensões dos três tipos de nó. **Ver [seção 3](#3-onde-mexer-em-tamanhos).** |
| `PALETA` | 7 cores cíclicas para os setores (`indice % 7`). |
| `montarMapa(registros, setoresExpandidos)` | **A função central.** Monta os 3 níveis: (1) raiz com a sigla do departamento; (2) um nó por sigla de setor, distribuídos em círculo — ângulo `(i / total) * 2π − π/2`, raio `max(320, nSetores * 90)`; (3) se o setor estiver expandido, as competências em leque de `0.8π` a 300 px do setor. Devolve `{ nos, ligacoes }`. |
| `ligacoesPorCamada(nos)` | Cria as **linhas tracejadas amarelas**: agrupa competências pela camada do SIG (`informacoesAcessadas`), ignora vazio/"nenhuma", e liga **em cadeia** (a→b→c, não todos-com-todos) apenas quando os setores são **diferentes**. É o "vínculo por campo semelhante": quem depende do mesmo dado precisa do mesmo acesso. |

> O layout radial é só **posição inicial**. Assim que o usuário arrasta um nó, `posicoes.ts` passa a mandar.

---

### 📄 `src/mapa/posicoes.ts` — Persistência das posições

| Função | Assinatura | O que faz |
|---|---|---|
| `lerPosicoes()` | `→ Promise<PosicoesSalvas>` | Lê o JSON do AsyncStorage (chave `@notadasi:posicoes-mapa`). Storage indisponível ou JSON corrompido → `{}` (volta ao layout automático). |
| `salvarPosicoes(posicoes)` | `→ Promise<void>` | Grava o mapa `{ [idDoNo]: {x, y} }`. Falha ao salvar **não** derruba a tela. |
| `limparPosicoes()` | `→ Promise<void>` | Apaga tudo — útil para um futuro botão "reorganizar mapa". *(Hoje não é chamada por ninguém.)* |

---

### 📄 `src/mapa/MapaMental.tsx` — Tela do mapa

| Função / componente | O que faz |
|---|---|
| `posicaoDe(no)` | Posição efetiva: a arrastada pelo usuário **vence** o layout automático (`posicoesSalvas[no.id] ?? {x, y}`). |
| `registrarPosicao(id, x, y)` | Atualiza o estado e persiste (efeito colateral dentro do `setState` updater). |
| `alternarSetor(sigla)` | Expande/recolhe um setor, com um `Set` imutável. |
| **Câmera** (`gestoPan`, `gestoPinca`) | `Gesture.Simultaneous` de pan + pinça. O zoom é limitado entre **0.25×** e **2.5×**; a escala inicial é **0.75×**. Os valores vivem em `useSharedValue` (thread de UI, sem re-render). |
| `<LinhasDoMapa>` | Desenha as arestas num `<Svg>` de **4000×4000 px** centrado (deslocado por `-centro`), com `pointerEvents="none"` para não roubar o toque. Linhas sólidas cinza = hierarquia; tracejadas amarelas = mesma camada. |
| `<NoArrastavel>` | Cada nó. `Gesture.Exclusive(arrastar, tocar)` — o toque só dispara se não virou arrasto. Ao soltar, `runOnJS(aoSoltar)` volta à thread JS para salvar. O `useEffect` com `referencia` faz o nó **acompanhar com mola** quando o layout recalcula (ex.: outro setor expandiu). Escala 1.06× enquanto arrasta. |
| Estado `carregado` | Enquanto lê o AsyncStorage, mostra "Montando o mapa..." — evita os nós "pularem" da posição automática para a salva. |

---

### 📄 `cpp/nota_busca_rapida.cpp` — Motor C++

| Função | Assinatura | O que faz |
|---|---|---|
| `dobrarAcentoLatin1(segundoByte)` | `→ char` *(anônima)* | Mapeia o 2º byte das sequências UTF-8 de 2 bytes iniciadas por `0xC3` (faixa Latin-1: á, ã, ç, é, í, ñ, ó, ú…) para o ASCII equivalente. Retorna `'\0'` se não houver equivalente. |
| `normalizarTexto(texto)` | `→ std::string` | Percorre byte a byte; ao ver `0xC3` seguido de byte mapeável, emite o ASCII e consome os dois bytes; senão aplica `tolower`. |
| `buscarTextoRapido(texto, termo)` | `→ std::vector<int>` | Normaliza os dois lados e roda `find` em laço, avançando pelo tamanho do termo. Devolve todas as posições. |
| `descriptografarTextoSimulado(texto)` | `→ std::string` | Desloca cada byte em −3. **Simulação didática, não é criptografia.** |

> **Limitação conhecida:** só trata acentos do bloco `0xC3`. Caracteres fora dele (ex.: `ª`, `º`, aspas tipográficas) passam sem normalizar — o `tolower` byte a byte também não os afeta.

---

### 📄 `cpp/jni_bridge.cpp` — Ponte JNI

Todo o arquivo é guardado por `#if defined(__ANDROID__)`, então compila sem erro em outras plataformas.

| Função | O que faz |
|---|---|
| `jstringParaStdString(env, valor)` | Converte `jstring → std::string`, sempre liberando com `ReleaseStringUTFChars`. Retorna `{}` se `nullptr`. |
| `Java_com_notadasi_NotaBuscaRapidaModule_nativeBuscarOcorrencias` | Converte as entradas, chama `buscarTextoRapido` e devolve um `jintArray`. |
| `Java_com_notadasi_NotaBuscaRapidaModule_nativeDescriptografarSimulado` | Converte, chama `descriptografarTextoSimulado`, devolve `jstring`. |

⚠️ **O nome da função C++ é um contrato com o Kotlin:** `Java_` + pacote com `_` + classe + método. Renomear a classe Kotlin ou mudar o pacote **quebra o link em tempo de execução** (`UnsatisfiedLinkError`) — e aí o app cai no fallback JS silenciosamente.

---

### 📄 `NotaBuscaRapidaModule.kt` — Módulo nativo

| Membro | O que faz |
|---|---|
| `getName()` | Retorna `"NotaBuscaRapida"` — é **esta string** que o JS acessa em `NativeModules.NotaBuscaRapida`. |
| `buscarOcorrencias(texto, termo, promise)` | `@ReactMethod`. Se a lib não carregou, rejeita com `ERRO_BIBLIOTECA_INDISPONIVEL`. Senão converte `IntArray → WritableArray` e resolve. |
| `descriptografarSimulado(texto, promise)` | Mesmo padrão. |
| `bibliotecaCarregada` (companion) | `System.loadLibrary("nota_busca_rapida")` dentro de `try/catch`. **Nunca derruba o app**: se o `.so` não existe para a ABI do aparelho, vira `false` e o JS usa o fallback. |

---

## 3. Onde mexer em TAMANHOS

### 3.1 Tamanho dos nós do mapa mental

**Arquivo:** `src/mapa/layout.ts` (linhas 25–30)

```ts
export const LARGURA_RAIZ = 200;         // caixa do departamento
export const ALTURA_RAIZ = 78;
export const LARGURA_SETOR = 180;        // caixas das siglas (DICI, DICTF...)
export const ALTURA_SETOR = 68;
export const LARGURA_COMPETENCIA = 220;  // caixas das competências
export const ALTURA_COMPETENCIA = 88;
```

Essas constantes são usadas em **dois lugares** e ambos continuam corretos automaticamente:
- ao criar o nó (`largura`/`altura` do `NoMapa`);
- no `NoArrastavel`, que centraliza o nó com `translateX: x - no.largura / 2`.

> A altura vira `minHeight` no estilo, então o nó **cresce** se o texto ocupar mais linhas. Para travar a altura, troque `minHeight: no.altura` por `height: no.altura` em `MapaMental.tsx`.

### 3.2 Espaçamento entre os nós (o mapa está "apertado" ou "espalhado demais")

**Arquivo:** `src/mapa/layout.ts`, dentro de `montarMapa`

| O que ajustar | Linha | Efeito |
|---|---|---|
| `const raioSetores = Math.max(320, siglas.length * 90)` | ~66 | Distância raiz → setores. Aumente o `90` se os setores estiverem colidindo. |
| `const raioCompetencias = 300` | ~97 | Distância setor → competências. |
| `const abertura = Math.PI * 0.8` | ~98 | Ângulo do leque de competências. `Math.PI * 1.2` espalha mais; valores pequenos empilham. |

### 3.3 Zoom e enquadramento inicial

**Arquivo:** `src/mapa/MapaMental.tsx`

```ts
const escala = useSharedValue(0.75);              // zoom inicial (linha ~85)
escala.value = Math.min(2.5, Math.max(0.25, proxima));  // limites (linha ~108)
const deslocX = useSharedValue(larguraTela / 2);  // centro da câmera (linha ~83)
```

Se o mapa tiver muitos setores e "nascer" cortado, baixe a escala inicial para `0.5`.

### 3.4 Área do SVG das linhas

**Arquivo:** `src/mapa/MapaMental.tsx`, em `LinhasDoMapa`

```ts
const TAMANHO = 4000;  // linha ~180
```

O SVG é um quadrado fixo centrado na origem. Se você aumentar muito os raios (3.2) e as linhas começarem a **sumir nas bordas**, aumente este valor — mas lembre que é área de renderização: valores enormes custam memória.

### 3.5 Tamanhos da interface (fontes, cartões, botões)

Todos vivem nos `StyleSheet.create` no fim de cada arquivo:

| Quero mudar | Arquivo | Chave do estilo |
|---|---|---|
| Título "Levantamento SIG" | `ListaRegistros.tsx` | `titulo.fontSize` (28) |
| Texto da competência no cartão | `ListaRegistros.tsx` | `competencia.fontSize` (14) / `lineHeight` (20) |
| Arredondamento e sombra do cartão | `ListaRegistros.tsx` | `cartao.borderRadius` (22), `elevation` (6) |
| Espaço interno do cartão | `ListaRegistros.tsx` | `areaCartao.padding` (18) |
| Altura do campo de busca | `BarraBusca.tsx` | `input.height` (52) |
| Altura máxima do modal | `DetalheRegistro.tsx` | `painel.maxHeight` (`'88%'`) |
| Barra de abas | `App.tsx` | `aba.paddingVertical` (12), `textoAba.fontSize` (12) |
| Fonte dos rótulos do nó | `MapaMental.tsx` | `rotuloNo.fontSize` (13), `rotuloRaiz.fontSize` (18) |

### 3.6 Quantidade de texto exibido

**Arquivo:** `src/components/ListaRegistros.tsx`

```ts
const resumir = (texto: string, limite = 130) => ...   // corte padrão
resumir(registro.comoAtende, 110)                       // corte do "como atende"
```

E no mapa, `layout.ts`: `rotulo: registro.competencia.slice(0, 60)` — o rótulo do nó é cortado em 60 caracteres. O `numberOfLines={2}` no `<Text>` do `MapaMental.tsx` limita a 2 linhas na tela.

### 3.7 Tamanhos no mapa da versão web

**Arquivo:** `web/src/mapa/layout.ts`

```ts
export const TAMANHOS = {              // um objeto no lugar das seis constantes
  raiz:        { largura: 220, altura: 84 },
  divisao:     { largura: 200, altura: 78 },
  pessoa:      { largura: 200, altura: 78 },
  competencia: { largura: 244, altura: 96 },
  documento:   { largura: 204, altura: 70 },
};

const raiosPorFolhas = (folhas: number) => {
  const base = Math.max(340, folhas * 36);           // raio do 1º anel (divisões)
  return [0, base, base * 1.8, base * 2.65, base * 3.4];
};
```

| O que ajustar | Efeito |
|---|---|
| `TAMANHOS` | Caixa de cada tipo de nó. A altura vira `min-height` no CSS, então o nó cresce se o texto ocupar mais linhas. |
| `Math.max(340, folhas * 36)` | Mapa apertado? Aumente o `36`. O raio já cresce com o **total de folhas**, não com o número de divisões. |
| Os multiplicadores `1.8 / 2.65 / 3.4` | Distância entre os anéis (divisão → pessoa → competência → documento). |
| `ESCALA_MIN` / `ESCALA_MAX` em `MapaMental.tsx` | Limites do zoom (0.2× a 2.4×). O zoom inicial **não é fixo**: `centralizar()` calcula a escala que faz tudo caber. |
| `TAMANHO_SVG = 12000` em `MapaMental.tsx` | Área do SVG das linhas. Só mexa se aumentar muito os raios e as linhas sumirem nas bordas. |
| `-webkit-line-clamp` em `.no-titulo` / `.no-subtitulo` (`estilos.css`) | Quantas linhas de texto o nó mostra (3 e 2). Aqui o rótulo **não é cortado** com `slice` — o CSS corta com reticências. |

---

## 4. Onde mexer em IMAGENS

### 4.1 Ícone do app

**Pasta:** `android/app/src/main/res/mipmap-*/`

| Densidade | Tamanho do PNG | Arquivos |
|---|---|---|
| `mipmap-mdpi` | 48×48 | `ic_launcher.png`, `ic_launcher_round.png` |
| `mipmap-hdpi` | 72×72 | idem |
| `mipmap-xhdpi` | 96×96 | idem |
| `mipmap-xxhdpi` | 144×144 | idem |
| `mipmap-xxxhdpi` | 192×192 | idem |

Substitua os 10 arquivos mantendo os nomes. O nome referenciado está no `AndroidManifest.xml` (`android:icon="@mipmap/ic_launcher"`).

> **Forma recomendada:** Android Studio → botão direito em `res` → *New → Image Asset*. Ele gera todas as densidades e, de quebra, o **ícone adaptativo** (`mipmap-anydpi-v26/ic_launcher.xml` + camadas de fundo/frente), que é o padrão desde o Android 8 e evita o ícone aparecer "colado" na borda.

### 4.2 Nome exibido do app

**Arquivo:** `android/app/src/main/res/values/strings.xml` → `<string name="app_name">`.

### 4.3 Adicionando imagens à interface React Native

Hoje o app **não usa nenhuma imagem** na UI — é tudo texto, cor e SVG. Para adicionar:

**Opção A — imagem local (empacotada no app):**

```tsx
// crie src/assets/logo.png e importe:
import { Image } from 'react-native';

<Image
  source={require('../assets/logo.png')}
  style={{ width: 120, height: 40 }}
  resizeMode="contain"
/>
```

Forneça `logo@2x.png` e `logo@3x.png` ao lado — o React Native escolhe pela densidade da tela automaticamente.

**Opção B — imagem remota (URL):**

```tsx
<Image
  source={{ uri: 'https://…/foto.png' }}
  style={{ width: 64, height: 64, borderRadius: 32 }}
/>
```

Imagens remotas **exigem `width` e `height` explícitos** — sem isso elas renderizam com tamanho zero. Esse é o erro mais comum.

**Opção C — ícones vetoriais:** o projeto já tem `react-native-svg` instalado (usado nas linhas do mapa). Você pode colar o conteúdo de um SVG direto como componente, sem instalar nada novo:

```tsx
import Svg, { Path } from 'react-native-svg';

const IconeAlerta = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path d="M12 2 L22 20 H2 Z" fill="#F9A8D4" />
  </Svg>
);
```

### 4.4 Se cada registro passar a ter uma foto

Três passos, na ordem:

1. **Tipo** — em `src/data/registros.ts`, adicione ao `Registro`:
   ```ts
   fotoUrl?: string;
   ```
2. **Importador** — espelhe o campo na dataclass de `scripts/importacao_de_xlsx.py` (senão o `registros.gerado.ts` nunca terá o campo).
3. **UI** — renderize com fallback, porque o campo é opcional:
   ```tsx
   {registro.fotoUrl ? (
     <Image source={{ uri: registro.fotoUrl }} style={estilos.foto} />
   ) : null}
   ```

> **Cuidado com o tamanho:** se as fotos forem locais e grandes, elas entram no APK. Prefira URLs remotas, ou redimensione para no máximo ~200 KB cada.

---

## 5. Reduzindo o tamanho do APK

O APK atual tem **~75 MB**. Isso não é normal para um app deste porte — a causa é conhecida e tem conserto.

### Causa 1 — quatro arquiteturas num APK só (o maior vilão)

**Arquivo:** `android/gradle.properties`

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

Cada ABI carrega uma cópia completa das bibliotecas nativas (React Native, Hermes, o nosso `.so`). São **4 cópias** dentro do mesmo arquivo.

**Correção A — gerar um APK por arquitetura.** Em `android/app/build.gradle`, dentro de `android { }`:

```gradle
splits {
    abi {
        enable true
        reset()
        include "armeabi-v7a", "arm64-v8a"
        universalApk false
    }
}
```

Resultado: dois APKs de ~15–20 MB. Aparelhos modernos usam o `arm64-v8a`.

**Correção B — para publicar na Play Store**, use o formato AAB, que já faz esse recorte por conta própria:
>>>>>>> Stashed changes

```bash
git clone https://github.com/<organizacao>/NotaDASI.git
cd NotaDASI
npm install
```

> **Na rede da Prefeitura** o `registry.npmjs.org` está bloqueado pelo firewall.
> Se o `npm install` travar ou der `ECONNRESET`, use o espelho oficial:
>
> ```bash
> npm install --registry https://registry.yarnpkg.com
> ```

---

## 2. Rodar no PC (navegador)

Não precisa de celular, emulador, JDK nem Android SDK.

<<<<<<< Updated upstream
=======
| Área | Por quê |
|---|---|
| Qualquer `StyleSheet.create` | Puramente visual, sem efeito em lógica. |
| `corPorSituacao` e `rotuloSituacao` | Um lugar só, propaga para toda a UI. |
| `PALETA` em `layout.ts` | Só afeta cor de setor. |
| Constantes `LARGURA_*` / `ALTURA_*` | Usadas de forma consistente. |
| Textos, rótulos e a dica do mapa | Sem dependências. |
| `registrosExemplo` | Só aparece quando não há planilha. |

### ⚠️ Cuidado — exige mudar em par

| Área | O par que precisa acompanhar |
|---|---|
| `normalizarTexto` (JS) | `nota_dasi::normalizarTexto` (C++) — senão a busca muda conforme o aparelho. |
| Campos de `Registro` | A dataclass em `scripts/importacao_de_xlsx.py`. |
| `textoPesquisavel` | Nada quebra, mas campo esquecido = campo não pesquisável. |
| `calcularSituacao` | A ordem das condições **é** a regra de negócio. Reordenar muda resultados. |

### 🚫 Não mexa sem entender a consequência

| Área | Risco |
|---|---|
| Nome da classe/pacote `NotaBuscaRapidaModule` | Quebra o link JNI (`Java_com_notadasi_...`) → `UnsatisfiedLinkError` silencioso. |
| `getName()` do módulo Kotlin | É a chave de `NativeModules.NotaBuscaRapida`. |
| `path "src/main/jni/CMakeLists.txt"` | Apontar direto para `cpp/CMakeLists.txt` faz sumir a `libappmodules.so` → **tela preta**. |
| Chave `@notadasi:posicoes-mapa` | Trocar descarta as posições salvas dos usuários. |
| `try/catch` vazios de `fonte.ts` e `posicoes.ts` | São intencionais: mantêm o app vivo quando o opcional falha. |

---

## 7. Roteiro de melhorias futuras

Ordenado por **valor entregue ÷ esforço**.

### 🥇 Curto prazo

1. **Reduzir o APK** — [seção 5](#5-reduzindo-o-tamanho-do-apk). Maior ganho imediato: 75 MB é um obstáculo real para distribuir por WhatsApp/e-mail.
2. **Botão "reorganizar mapa"** — `limparPosicoes()` já existe em `posicoes.ts` e **nunca é chamada**. É um botão ligando numa função pronta. *(Já feito na web: botão «reposicionar».)*
3. **Indicador de origem no mapa** — a lista mostra "dados de exemplo", o mapa não. Basta usar `obterOrigemDados()` no `MapaMental.tsx`. *(Já feito na web: rodapé.)*
4. **Destacar o trecho encontrado** — `buscarOcorrencias` já devolve as **posições** de cada ocorrência, e hoje o código só usa `length > 0`. Dá para pintar o trecho no cartão sem tocar no C++.
5. **Levar o mapa de 4 níveis e os documentos para o app** — a lógica está pronta e é agnóstica de plataforma (`src/data/documentos.ts` + `web/src/mapa/layout.ts`). No mobile falta portar o layout (trocar `Set` de expandidos por `recolhidos`), trocar `localStorage` por `AsyncStorage` e escolher o anexo com um *document picker* em vez de `<input type="file">`.

### 🥈 Médio prazo

6. **Testes das regras de negócio** — `calcularSituacao`, `textoPesquisavel`, `normalizarChave`, `validarDocumento` e `montarMapa` são funções puras, fáceis de testar. O Jest já está configurado (`jest.config.js`), e hoje `__tests__/` está praticamente vazio.
7. **Filtro por situação** — já existe filtro por setor; um filtro por "Pendente / Com problema" responde a pergunta mais frequente do levantamento ("o que falta?"). *(Já feito na web: os chips da barra.)*
8. **Tela de resumo** — contagens por setor e por situação. Todos os dados já estão em memória; é agregação simples com `reduce`.
9. **Exportar o que está filtrado** — gerar CSV do resultado da busca para levar a reuniões. *(Na web já sai JSON do acervo de documentos: `exportarAcervo`.)*
10. **Acervo de documentos compartilhado** — hoje o `localStorage` é por navegador: o que a DASI anexa não chega à chefia. Um backend simples (ou uma pasta no Drive com o JSON) tira essa limitação.

### 🥉 Longo prazo

11. **Busca incremental no C++** — hoje `executarBusca` roda `Promise.all` sobre **todos** os registros a cada tecla, com uma travessia da ponte JNI por registro. Com centenas de registros isso pesa. Alternativas: mandar tudo de uma vez numa chamada só, ou construir um índice invertido no C++.
12. **Normalização Unicode completa no C++** — hoje só o bloco `0xC3`. Uma tabela maior (ou ICU) cobriria todos os casos.
13. **Migrar para a TurboModule API** — `newArchEnabled=true` já está ligado, mas o módulo ainda usa a bridge antiga (`ReactContextBaseJavaModule`). TurboModules dão chamadas síncronas e tipagem gerada por codegen.
14. **Modo claro** — as cores estão espalhadas por 6 `StyleSheet`. Um arquivo `tema.ts` com tokens seria o pré-requisito.
15. **Edição no app** — hoje é somente leitura. Editar exigiria repensar a origem dos dados (`fonte.ts` é read-only por design).

---

## 8. Receitas rápidas

### Trocar a cor de uma situação
`src/data/registros.ts` → `corPorSituacao`. Uma linha, propaga para cartão, selo e nó do mapa.

### Fazer um campo novo ser encontrado pela busca
`src/data/registros.ts` → adicione ao array de `textoPesquisavel`.

### Deixar a busca mais/menos "nervosa"
`src/components/ListaRegistros.tsx` → `setTimeout(..., 250)`. Menor = responde antes, gasta mais CPU.

### Mudar o zoom inicial do mapa
`src/mapa/MapaMental.tsx` → `useSharedValue(0.75)` em `escala`.

### Afastar os setores uns dos outros
`src/mapa/layout.ts` → `Math.max(320, siglas.length * 90)`, aumente o `90`.

### Ver se a busca está usando C++ ou o fallback JS
Em `src/native/NotaBuscaRapida.ts`, ponha um `console.log` dentro do `catch` e outro após o `if (resultado)`. No `adb logcat`, `UnsatisfiedLinkError` indica que o `.so` não foi empacotado para a ABI do aparelho.

### Compilar só para o emulador (build mais rápido)
`android/gradle.properties` → `reactNativeArchitectures=x86_64`.

### Limpar tudo quando o build ficar estranho
>>>>>>> Stashed changes
```bash
npm run dev
```

<<<<<<< Updated upstream
Abra **http://localhost:5173**.

> Se a porta estiver ocupada, o Vite sobe em 5174, 5175... — use a que ele
> imprimir no terminal.

Entre com uma das contas padrão:

| Conta | Senha |
|---|---|
| `DASI` | `dasi` |
| `GERENTE - DGEO` | `gerente` |
| `SECRETARIO` | `secretario` |

Outros comandos do alvo PC:

```bash
npm run dev:build      # build de produção em pc/dist/
npm run dev:preview    # serve o build de produção
```

---

## 3. Rodar no Android

### 3.1 Pré-requisitos

- Node.js 22.11 ou superior
- JDK 17
- Android SDK com **NDK** e **CMake** (o projeto compila C++)
- Um emulador ou um aparelho com depuração USB

Confira o que já está instalado:

```bash
node --version                     # >= 22.11
java -version                      # 17
echo $ANDROID_HOME                 # no PowerShell: echo $env:ANDROID_HOME
```

### 3.2 Configurar as variáveis de ambiente (Windows, PowerShell)

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator"
```

Feche e reabra o terminal depois do `setx`.

### 3.3 Instalar NDK e CMake pela linha de comando

```bash
sdkmanager "ndk;27.1.12297006" "cmake;3.22.1" "platform-tools" "platforms;android-35"
```

### 3.4 Subir um emulador

```bash
emulator -list-avds                       # lista os emuladores existentes
emulator -avd NotaDASI_Emulator           # sobe um deles
adb devices                               # confirme que aparece como "device"
```

### 3.5 Instalar e rodar

```bash
npm run android
```

O Gradle compila a biblioteca nativa automaticamente — não há passo manual de
compilação do C++.

---

## 4. Gerar o APK

```bash
cd android
./gradlew assembleRelease          # no Windows: .\gradlew.bat assembleRelease
```

O arquivo sai em `android/app/build/outputs/apk/release/`.

Para gerar só o bundle JS, sem o build completo:

```bash
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
```

---

## 5. Importar a planilha do levantamento

```bash
npm run importar-xlsx -- sua_planilha.xlsx --ts src/data/registros.gerado.ts
```

Enquanto `registros.gerado.ts` não existir, o app usa os dados de exemplo e
mostra "dados de exemplo" no subtítulo.

---

## 6. Verificar o projeto

```bash
npm test                                   # testes (Jest)
npm run lint                               # ESLint
npx tsc --noEmit -p tsconfig.json          # tipos do alvo Android
npx tsc --noEmit -p pc/tsconfig.json       # tipos do alvo PC
```

---

## 7. Quando algo dá errado

| Sintoma | Comando |
|---|---|
| Metro com cache velho | `npx react-native start --reset-cache` |
| Build do Gradle inconsistente | `cd android && ./gradlew clean` |
| Vite com dependências pré-empacotadas velhas | `rm -rf node_modules/.vite && npm run dev` |
| `npm install` quebrado pela metade | `rm -rf node_modules package-lock.json && npm install` |
| Emulador aparece como `offline` | `adb kill-server && adb start-server` |
| App abre com uma versão **antiga** da tela, mesmo com o Metro rodando | Ver a armadilha do bundle embutido, abaixo. |
| Esqueceu a senha da conta | `adb shell pm clear com.notadasi` (Android) ou apague o IndexedDB do site em *DevTools → Application* (PC): as contas padrão voltam com a senha inicial. |

### O app abre com a tela antiga

Se `android/app/src/main/assets/index.android.bundle` existir, ele vai junto
dentro do APK e o app **cai nele** quando não consegue falar com o Metro (porta
8081 sem `adb reverse`, Metro ainda subindo, etc.). O sintoma engana: o app
abre normalmente, sem erro nenhum, só com o código de semanas atrás.

Para sair disso:

```bash
adb reverse tcp:8081 tcp:8081

# regenera o bundle embutido com o código atual
npx react-native bundle \
  --platform android \
  --dev true \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res

adb shell pm clear com.notadasi
npm run android
```

Esse arquivo é artefato de build e está no `.gitignore` — apagá-lo também
resolve, e evita que a pegadinha volte.
=======
### Anexar um documento a uma pessoa (versão web)
Clique no `+ 📎` do nó da pessoa — o painel abre com o alvo já preenchido. Ou abra *📎 Documentos* na barra e escolha no seletor "Alocado a".

### Apagar tudo o que a versão web guardou
No console do navegador (F12):
```js
localStorage.removeItem('@notadasi:web:documentos');
localStorage.removeItem('@notadasi:web:posicoes');
localStorage.removeItem('@notadasi:web:preferencias');
```

### Mudar a porta da versão web
`web/vite.config.ts` → `server.port`, ou `npm run dev -- --port 3000`.

### Acrescentar um tipo de documento (ex.: "Decreto")
`src/data/documentos.ts` → adicione em `TipoDocumento`, `rotuloTipoDocumento` e `iconeTipoDocumento`, e na lista `tipos` de `web/src/documentos/PainelDocumentos.tsx`. O TypeScript aponta o que faltou.

---

## 9. Versão web: mapa melhorado + documentos

```bash
npm run dev     # http://localhost:5173
```

`scripts/dev-web.mjs` instala as dependências de `web/` na primeira execução e sobe o Vite. A pasta `web/` tem o **seu próprio `package.json`** de propósito: as dependências do React Native e as do Vite não se misturam.

### 9.1 O que mudou no mapa (e por quê)

| Problema do mapa mobile | Solução na web | Onde |
|---|---|---|
| A pessoa não aparecia — só o setor e a competência | **Quarto nível**: Departamento → Divisão → **Pessoa** → Competência | `web/src/mapa/layout.ts` |
| Ramos se atropelavam: cada setor recebia `(i / total) * 2π`, com 2 ou com 40 competências | Fatia de ângulo **proporcional às folhas** de cada ramo (`contarFolhas`) | `posicionar()` em `layout.ts` |
| Com tudo aceso, não dava para seguir um ramo | **Modo foco**: clicar acende o nó, os ancestrais e a subárvore; o resto vai a 16% | `subarvoreEAncestrais()` + classe `.esmaecido` |
| A busca ficava só na lista | A busca **realça** no mapa (contorno azul) e acende os ramos encontrados | `encontrados` em `montarMapa` |
| Expandir era só por setor | **Recolher/expandir** divisão *e* pessoa, com contador `▸ N` do que está escondido | `recolhidos: Set<string>` |
| Zoom inicial fixo em 0.75× | `centralizar()` calcula a escala que faz **tudo** caber; a roda do mouse dá zoom **ancorado no cursor** | `MapaMental.tsx` |
| Não havia onde guardar documento | **Nós de documento** ligados por linha pontilhada ao dono, selo `📎 N` e botão `+ 📎` | `layout.ts` + `documentos/` |

### 9.2 Referência das funções (web)

#### 📄 `web/src/mapa/layout.ts`

| Função / constante | O que faz |
|---|---|
| `TipoNo` | `raiz \| divisao \| pessoa \| competencia \| documento`. |
| `NoMapa` | Além do que o mobile tem: `documentos` (quantos anexos), `alvo` (`"divisao:dici"`), `recolhivel`, `recolhido`, `filhosOcultos`, `documento`. |
| `TAMANHOS` | Largura/altura por tipo de nó — [seção 3.7](#37-tamanhos-no-mapa-da-versão-web). |
| `raiosPorFolhas(folhas)` | Raio de cada anel. Cresce com o total de folhas do mapa, não com o número de divisões. |
| `montarMapa({ registros, documentos, recolhidos, situacoes, mostrarDocumentos, busca })` | **A função central.** Filtra por situação, monta a árvore de 4 níveis pendurando cada documento no alvo certo, posiciona em radial proporcional, achata em `nos`/`ligacoes` e devolve também `encontrados` (busca) e `paiDe` (foco). |
| `ligacoesPorCamada(nos)` | Igual à do mobile: liga em cadeia competências de **divisões diferentes** que usam a mesma camada do SIG. |
| `subarvoreEAncestrais(id, paiDe)` | O nó + a linha de ancestrais + **todos** os descendentes. Os irmãos dos ancestrais ficam de fora **de propósito** — é isso que faz o foco esmaecer o resto em vez de acender a árvore inteira. |
| `normalizar(texto)` | Sem acento, minúsculo — usada pela busca. |

#### 📄 `web/src/mapa/MapaMental.tsx`

| Função / trecho | O que faz |
|---|---|
| `centralizar()` | Calcula a caixa de todos os nós e escolhe escala + deslocamento para caber com 80 px de margem. Roda na primeira renderização e no botão `⤢`. |
| `aoPressionarFundo` / `aoMoverFundo` | *Pan*: guarda a câmera no `pointerdown` e soma o deslocamento do ponteiro. |
| `aplicarZoom(fator, x, y)` | Converte o ponto da tela em coordenada de mundo, aplica a escala e recoloca o mesmo ponto sob o cursor. É o que faz o zoom "ancorar" onde o mouse está. |
| `useEffect` do `wheel` | Listener **nativo** com `{ passive: false }` — o React registra listeners passivos e não deixaria chamar `preventDefault()`. |
| `aoPressionarNo` / `aoMoverNo` / `aoSoltarNo` | Arrasto por nó com `setPointerCapture`. O deslocamento é dividido pela escala (senão o nó "corre" no zoom). Abaixo de `LIMIAR_ARRASTO` (4 px) o gesto vira **clique**, não arrasto. |
| `previa` | Posição temporária enquanto arrasta: as linhas acompanham o nó em tempo real sem gravar no `localStorage` a cada pixel. |
| `curva(origem, destino)` | Caminho `Q` (quadrático) com o ponto de controle empurrado na perpendicular: 12% do comprimento. `0` deixa as linhas retas. |
| `esmaecido(id)` | `emFoco.size > 0 && !emFoco.has(id)` — aplica a classe `.esmaecido` em nós e linhas. |

#### 📄 `web/src/documentos/armazenamento.ts`

| Função | O que faz |
|---|---|
| `lerDocumentos` / `salvarDocumentos` | `localStorage`, chave `@notadasi:web:documentos`. |
| `lerPosicoes` / `salvarPosicoes` | Chave `@notadasi:web:posicoes` — mesma estrutura `{ [id]: {x, y} }` do `AsyncStorage` do app. |
| `lerPreferencias` / `salvarPreferencias` | Interruptores "documentos no mapa" e "ligações por camada". |
| `lerArquivo(arquivo)` | `FileReader` → data URL (base64). Recusa acima de `LIMITE_ARQUIVO_BYTES` (2 MB). |
| `exportarAcervo(documentos)` | Baixa um `.json` com documentos + posições (`Blob` + `URL.createObjectURL`). |
| `importarAcervo(arquivo)` | Lê o `.json` de volta; o `App` descarta ids repetidos em vez de duplicar. |

> Os `try/catch` mudos em `ler`/`gravar` são intencionais: navegador em modo privativo, storage bloqueado por política ou cota estourada **não podem** derrubar a tela.

#### 📄 `web/src/documentos/PainelDocumentos.tsx`

Formulário + lista do acervo. `submeter` monta o `Documento`, chama `validarDocumento` e só então salva; `editar(documento)` recarrega o formulário — é o que acontece ao clicar num nó de documento no mapa. O seletor "Alocado a" é agrupado por `<optgroup>` (Departamento / Divisão / Pessoa) a partir de `listarAlvos`.

#### 📄 `web/src/componentes/DetalheRegistro.tsx`

Modal da competência: as oito respostas booleanas em grade (Sim / Não / —), os campos de texto e, no rodapé, **os documentos da pessoa e da divisão** daquela competência, com atalhos para anexar mais.

#### 📄 `web/src/App.tsx`

Orquestra tudo: documentos, posições, preferências, recolhidos, filtros e busca; calcula `emFoco` (o nó clicado manda; sem clique, quem destaca é a busca); persiste cada estado no seu `useEffect`.

### 9.3 Limites conhecidos

- **O acervo é local**: `localStorage` é por navegador e por máquina. O que a DASI anexar não aparece para a chefia — use exportar/importar, ou veja o item 10 do [roteiro](#7-roteiro-de-melhorias-futuras).
- **Anexo de até 2 MB**, porque vira base64 dentro do `localStorage` (que costuma ter ~5 MB no total). Documento grande entra como **link**.
- **Pessoa é identificada pelo nome** (`idDaPessoa`): homônimos colidem.
- A busca aqui é **JS puro** — o motor C++ é do app Android e não roda no navegador.

### 9.4 Levar isso para o app mobile

Reaproveitável sem mudança: `src/data/registros.ts` e `src/data/documentos.ts` (nenhum dos dois depende de plataforma). O que precisa de porte:

| Peça | No mobile |
|---|---|
| `localStorage` | `AsyncStorage` — `src/mapa/posicoes.ts` já mostra o padrão. |
| `<input type="file">` | Um *document picker* (ex.: `react-native-document-picker`) + leitura em base64. |
| `<div>` + CSS | `View`/`Text` + `StyleSheet`, como no `MapaMental.tsx` atual. |
| Pointer events | `react-native-gesture-handler` — o app já usa `Gesture.Pan` e `Gesture.Pinch`. |
| `montarMapa` da web | Copiar para `src/mapa/` trocando `setoresExpandidos` por `recolhidos`; o resto do algoritmo é agnóstico de plataforma. |
>>>>>>> Stashed changes
