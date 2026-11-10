# Parte 1 — Perfil SMTI, gestão de usuários e log de alterações

Data: 2026-11-10 · Estado: aguardando revisão

## Objetivo

Dar ao NotaDASI um perfil administrativo isolado (**SMTI**) que audita tudo o
que é criado, editado e apagado no app, cria usuários com nível de hierarquia,
redefine senhas e configura o endereço do banco. Toda alteração de dados passa
a deixar um registro com autor, data e "antes → depois".

## Contexto

- O app é 100% local: dados, contas e sessão ficam no AsyncStorage do aparelho
  (IndexedDB no navegador). Não há servidor; só o esquema em `db/schema.sql`.
- Decisão do cliente: **local agora, servidor depois**. O log nasce num formato
  que vira uma tabela sem conversão.
- Hoje o papel da conta só rotula quem entrou, e nenhuma função de escrita
  sabe quem está logado.

## Fora de escopo (partes seguintes)

- **Parte 2:** Gerente e Secretário apenas visualizam as notas da DASI; abas
  privadas (Gerente cria para a Secretaria consultar; Secretário cria só para
  si).
- **Parte 3:** várias unidades de topo lado a lado no mapa, junto com o DRCF.
- Sincronização real com o servidor.

Nesta parte o nível de hierarquia é **gravado e exibido**, mas ainda não
bloqueia edição para Gerente e Secretário.

## 1. Contas e níveis

`src/auth/contas.ts`

- `PapelConta` passa a ser `'dasi' | 'gerente' | 'secretario' | 'smti'`. Contas
  salvas com o antigo `'outro'` são lidas como `'dasi'`.
- Rótulos dos níveis: DASI, Gerente, Secretário, SMTI.
- Nova conta de fábrica: usuário `SMTI`, nome `SMTI`, papel `smti`, descrição
  "Administração do sistema — auditoria, usuários e banco", senha inicial
  `smti`. Entra em `CONTAS_PADRAO` e `SENHA_INICIAL`, então aparece na tela de
  entrada como as outras.
- Funções puras novas (testáveis sem React):
  - `criarConta(contas, { nome, papel, senha })` → devolve a lista nova ou um
    erro: nome vazio, nome já existente (comparado por `normalizarUsuario`),
    senha com menos de 3 caracteres.
  - `redefinirSenha(contas, usuario, senhaNova)` → mesma regra de 3 caracteres.
  - `excluirConta(contas, usuario)` → recusa contas com `padrao: true`.

`src/auth/useSessao.tsx` expõe `criarConta`, `redefinirSenha` e `excluirConta`,
que só funcionam quando `contaAtual.papel === 'smti'`, gravam em
`@notadasi:contas` e registram no log. `trocarSenha` (a própria senha) também
passa a registrar no log.

## 2. Log de alterações

Novo módulo `src/auditoria/`.

### Formato (`tipos.ts`)

```ts
type AcaoLog = 'criar' | 'editar' | 'excluir' | 'redefinir-senha' | 'trocar-senha' | 'limpar-dados' | 'configurar-banco';
type AlvoLog = 'competencia' | 'aba' | 'item' | 'conta' | 'dados' | 'banco';

type EntradaLog = {
  id: string;
  quando: string;        // ISO 8601
  usuario: string;       // conta.usuario de quem fez
  nomeUsuario: string;
  papel: PapelConta;
  acao: AcaoLog;
  alvoTipo: AlvoLog;
  alvoId: string;
  alvoRotulo: string;    // texto legível: competência, nome da aba, nome da conta
  antes?: Record<string, unknown>;   // editar e excluir
  depois?: Record<string, unknown>;  // criar e editar
};
```

Regras:

- `criar` guarda `depois`; `excluir` guarda `antes` (o conteúdo apagado);
  `editar` guarda os dois, **só com os campos que mudaram**.
- Uma edição que não muda nada não gera entrada.
- Senhas e hashes **nunca** entram no log; eventos de senha registram só o
  alvo.
- Excluir uma aba registra a aba e quantos itens foram junto.
- Favoritar, trocar de aba, tema, entrar e sair não são registrados.

### Diferenças (`diferencas.ts`)

`calcularDiferencas(antes, depois)` → lista de `{ campo, antes, depois }`,
comparando por valor (objetos de contato comparados campo a campo). É função
pura. A tela usa `src/auditoria/rotulos.ts` para trocar o nome técnico do
campo pelo rótulo do formulário (`sistemaAtende` → "O sistema atende?") e
`true/false/undefined` por "Sim/Não/—".

### Armazenamento (`armazenamento.ts`)

- Chave `@notadasi:auditoria`, uma lista de `EntradaLog`, só com acréscimo: a
  API expõe `registrar(entrada)` e `lerLog()`. Não há editar nem apagar.
- As gravações são enfileiradas numa única promessa, para duas ações seguidas
  não se sobrescreverem.
- Sem descarte automático de entradas antigas.
- Falha ao gravar o log não impede a ação do usuário (mesmo critério do resto
  do app).

### Onde as entradas são geradas

- `src/app/useAplicacao.ts` — é o ponto único por onde passam as ações das
  duas cascas (celular e PC). Lê `contaAtual` via `useSessao` e registra em:
  `salvarFormulario`, exclusão de competência, `criarCampo`, `atualizarCampo`,
  `excluirCampo`, `salvarAnotacao`, exclusão de item e `limparDadosLocais`.
- `src/auth/useSessao.tsx` — eventos de conta.
- `src/data/integracao.ts` / telas que salvam a URL — `configurar-banco`, com
  o endereço antigo e o novo.

"Limpar dados locais" continua apagando criados, edições, exclusões e
favoritos, mas **não apaga o log** e gera a própria entrada.

## 3. Painel SMTI

`src/smti/PainelSmti.tsx`, mais uma tela por seção.

`PortaDeEntrada` passa a decidir três casos: sem sessão → login; papel `smti` →
`<PainelSmti />`; demais → o app de hoje. Como a porta é comum aos dois alvos,
o painel vale para celular e PC sem mexer nas cascas. O SMTI não vê mapa,
lista nem abas.

Seções:

- **Usuários** — lista de contas com nível; criar (nome, nível, senha
  inicial); redefinir senha; excluir (só contas não padrão, com confirmação).
- **Log** — lista do mais recente para o mais antigo, com data e hora, quem,
  ação e alvo. Tocar numa entrada abre o "antes → depois" campo a campo.
  Filtros por usuário, ação e tipo de alvo. Mostra o total de entradas.
- **Banco** — o mesmo campo "Endereço do servidor (API)" de Ajustes, gravado
  na mesma chave (`@notadasi:servidor-url`), com o mesmo aviso de que a
  sincronização ainda não está ativa.
- **Conta** — reaproveita `SecaoConta` (trocar a própria senha, sair).

As outras contas continuam com a seção "Integração com servidor" em Ajustes
exatamente como hoje; a única mudança é que salvar passa a gerar log.

## 4. Preparação para o servidor

`db/schema.sql` ganha a tabela `auditoria`, com as mesmas colunas de
`EntradaLog` (`antes` e `depois` como `JSONB`) e índices por `quando` e
`usuario`. Nada é enviado nesta parte.

## Limites conhecidos

- Cada aparelho tem as próprias contas e o próprio log.
- Quem tiver acesso ao aparelho pode apagar o armazenamento do navegador ou do
  app: o log local não é prova contra adulteração. Isso só o servidor resolve.
- A senha continua com o hash simples de hoje; não é barreira de segurança.

## Testes (Jest)

- `contas`: criar com nome duplicado, senha curta, redefinir, recusar excluir
  conta padrão, SMTI presente depois de `reconciliarContas`, migração de
  `'outro'`.
- `diferencas`: só campos alterados, contato aninhado, sem mudança → vazio.
- `armazenamento`: duas gravações seguidas preservam as duas entradas.
- `useAplicacao`: criar, editar e excluir competência geram entradas com o
  autor da sessão; "Limpar dados locais" mantém o log.
- Entrada: logar como SMTI mostra o painel e não o app; logar como DASI não
  mostra o painel.
- Senha nunca aparece em nenhuma entrada do log.
