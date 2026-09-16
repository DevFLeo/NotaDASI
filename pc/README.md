# NotaDASI no PC (`npm run dev`)

Alvo web do NotaDASI, para abrir o app no navegador em `http://localhost:5173`
sem precisar de celular ou emulador.

Entre com uma das contas padrão — `DASI`/`dasi`, `GERENTE - DGEO`/`gerente`
ou `SECRETARIO`/`secretario` (ver [Contas e acesso](../README.md#contas-e-acesso)).

```bash
npm install
npm run dev
```

Outros comandos: `npm run dev:build` (build de produção em `pc/dist/`) e
`npm run dev:preview` (serve esse build).

> **Rede da Prefeitura:** `registry.npmjs.org` está bloqueado pelo firewall
> (a conexão TLS é cortada; Google e GitHub passam normalmente). Se o
> `npm install` travar ou der `ECONNRESET`, use o espelho oficial:
>
> ```bash
> npm install --registry https://registry.yarnpkg.com
> ```

## O que esta pasta é

Uma **casca**, não uma segunda versão do app. Não há cópia de tela, de
componente nem de dado aqui:

| Arquivo | Papel |
|---|---|
| `index.html` | A página. Também corrige a altura da raiz (ver abaixo). |
| `main.tsx` | Monta os mesmos provedores e a mesma porta de entrada do `App.tsx`. Equivale ao `index.js` do Android. |
| `RaizPC.tsx` | Escolhe a casca pela largura da janela: monitor ou celular. |
| `CascaPC.tsx` | A **única** tela que só existe aqui: barra lateral, mapa em foco, painel 35/65. |
| `vite.config.mts` | Resolução por plataforma, worklets do Babel e os aliases. |
| `shims/` | As APIs que o react-native-web não tem, e tipos que ele não publica. |

Qualquer mudança em `src/` aparece nos dois alvos ao mesmo tempo. É esse o
objetivo: **um código só**. O app não tem nenhum `Platform.OS === 'web'`
espalhado — tudo que era específico do navegador está contido nesta pasta.

### O que a `CascaPC` é (e o que ela não é)

Ela desenha **geometria**, não regras. Todo o estado vem de
`src/app/useAplicacao.ts` — o mesmo hook que o `App.tsx` do celular usa — e os
formulários vêm de `src/app/Modais.tsx`. Uma regra nova (uma confirmação de
exclusão, um campo a mais no cadastro) entra uma vez em `src/` e vale nos dois
alvos, sem ninguém precisar lembrar desta pasta.

Abaixo de **900px de largura** a `RaizPC` devolve o controle à casca do celular
(`AppConteudo`, exportado de `App.tsx`). Arrastar a borda da janela alterna
entre as duas na hora, porque as duas leem o mesmo estado.

Duas coisas em `src/` existem por causa desta tela, mas **não a conhecem**:

- `MenuCampos` aceita `embutido` — desenha sem Modal e sem alça, para caber no
  painel de 35%. Sem a prop, é exatamente a folha de sempre do Android.
- `MapaMental` mede o **próprio container** (`onLayout`) em vez da janela. No
  celular dá na mesma; aqui é o que impede o mapa de se centralizar num ponto
  atrás do painel.

## Sobre "o mesmo banco de dados"

Há duas coisas diferentes chamadas de "dados" no projeto, e só uma é de fato
compartilhada hoje.

### ✅ A base do diagnóstico — compartilhada de verdade

`src/data/registros.gerado.ts` (as 39 competências do DRCF, geradas da planilha
por `npm run importar-xlsx`) é lido por `src/data/fonte.ts`, fonte única dos
dois alvos. O navegador e o Android carregam **exatamente o mesmo arquivo**.

### ❌ As alterações do usuário (e as contas) — NÃO são compartilhadas

O que você cria, edita, exclui ou favorita fica em `AsyncStorage`
(`src/data/useRegistros.ts`), que não é um banco central. **As contas e a sessão
(`src/auth/`) usam o mesmo armazenamento e a mesma chave nos dois alvos**, o que
significa que a sessão sobrevive a recarregar a aba — mas não que ela atravesse
de um aparelho para o outro. Trocar a senha no PC não muda a senha no celular:

- no **Android**, um banco dentro do sandbox do APK;
- no **navegador**, um banco **IndexedDB** daquele perfil, naquele PC. (Não é
  `localStorage`: o AsyncStorage usa IndexedDB na web — importa saber na hora de
  inspecionar os dados pelo DevTools, em *Application → IndexedDB*.)

São depósitos fisicamente separados. Uma competência criada no PC **não**
aparece no celular. Isso não é limitação desta pasta: é a mesma razão pela qual
dois celulares com o app hoje também não se enxergam.

Para os dois verem o mesmo estado é preciso o servidor — o Postgres planejado
em `db/schema.sql`, com uma API HTTP na frente e uma camada de sincronização no
app (fila de pendências + carimbo de tempo por registro). Nada disso existe
ainda; `src/data/integracao.ts` hoje só guarda a URL.

**O lado bom:** quando essa sincronização for implementada em `src/data/`, ela
vale para os dois alvos automaticamente — e o PC vira o jeito mais prático de
testá-la, porque o DevTools do navegador mostra as requisições.

## Armadilhas que já custaram caro

Quatro problemas apareceram ao montar este alvo. Três eram **silenciosos** —
o app subia e parecia certo. Ficam registrados para não voltarem:

1. **`require()` em `fonte.ts` mostrava os dados errados.** O `require` funciona
   no Metro mas não existe no bundle do navegador. Ele lançava, o `catch`
   engolia em silêncio e o PC exibia os **5 registros de exemplo** em vez das
   **39 da planilha** — sem nenhum erro no console. Hoje o import é estático
   (ESM), que funciona nos dois alvos. *Se alguém trocar de volta para
   `require`, o Android continua certo e só o PC mente.*

2. **O botão "+" ficava fora da janela.** A raiz do App é um `SafeAreaView`
   com `flex: 1`; na web, `#root` era um bloco sem altura definida, então o
   container esticava até a altura do conteúdo e o FAB (`position: absolute`,
   `bottom: 20`) ia parar a ~6300px do topo. A lista aparecia normalmente —
   só adicionar competência era impossível. Corrigido no CSS do `index.html`.

3. **O plugin de worklets não rodava.** O `@vitejs/plugin-react` 6 não tem
   mais opção `babel` (o Vite 8 transforma com oxc) e **ignora em silêncio** se
   você passar uma. Sem ele o Reanimated quebra na primeira tela. Por isso o
   `vite.config.mts` roda o Babel num plugin próprio.

4. **O pré-empacotador não enxerga a lista `plugins`.** O resolvedor de
   variantes `.web.js` precisa ser registrado **duas vezes**: em `plugins` e em
   `optimizeDeps.rolldownOptions.plugins`. Sem o segundo, o build morre nos
   arquivos Flow do react-native.

## Sobre os shims

- **`Alert`** → `window.alert` / `window.confirm` (12 usos no app);
- **`Clipboard`** → `navigator.clipboard` (copiar telefone);
- **`NativeModules`** → vazio, para `src/native/NotaBuscaRapida.ts` usar o
  fallback em JS no lugar da busca em C++ (`cpp/`);
- **`assets-registry`** → stub; o react-native-svg só o usaria para `<Image>`
  dentro de SVG, que o app não faz;
- **`validate-worklets-version`** → stub; a checagem real continua rodando no
  build do Android, via Metro.

## Limitações conhecidas

- A busca usa o fallback em JS, não o módulo C++ — imperceptível neste volume.
- `Alert` com botões vira o `confirm` do navegador, sem o vermelho do
  "destructive".
- Gestos de arrastar funcionam com mouse, mas foram desenhados para o toque.
- O bundle sai com ~990 kB num arquivo só. Para uso em localhost não importa;
  se um dia isso for publicado, vale ativar code splitting.
