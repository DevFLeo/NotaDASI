# NotaDASI

Aplicativo de notas para Android com foco em experiência visual fluida e alta performance, combinando três camadas de tecnologia:

- **React Native (TypeScript)** — interface, listagem de notas e animações com `react-native-reanimated`.
- **C++ (NDK/CMake)** — busca rápida de texto e uma função de descriptografia simulada, expostas ao JavaScript por um módulo nativo (JNI).
- **XML nativo (Android)** — layout de cabeçalho de referência para uso em componentes nativos customizados.

## Estrutura do projeto

```
App.tsx                          Ponto de entrada do app React Native
src/
  components/
    ListaNotas.tsx               Tela principal: lista de notas + busca
    BarraBusca.tsx                Campo de busca
  data/
    notas.ts                     Fonte única dos dados de exemplo (Nota, tipos, notasExemplo)
  native/
    NotaBuscaRapida.ts           Wrapper TypeScript do módulo nativo, com fallback em JS puro
cpp/
  nota_busca_rapida.h/.cpp       Lógica de busca de texto e descriptografia simulada
  jni_bridge.cpp                 Ponte JNI que expõe as funções C++ ao Kotlin
  CMakeLists.txt                 Build da biblioteca nativa (nota_busca_rapida)
android/
  app/src/main/jni/
    CMakeLists.txt               Integra o CMake do React Native + o nosso C++
  app/src/main/java/com/notadasi/
    NotaBuscaRapidaModule.kt     Módulo nativo (React Native) que chama o JNI
    NotaBuscaRapidaPackage.kt    Registro do módulo no React Native
    MainApplication.kt           Registro do NotaBuscaRapidaPackage
  app/src/main/res/
    layout/nota_header.xml       Referência de cabeçalho nativo em XML
    drawable/fundo_header.xml    Fundo do cabeçalho
```

## Como a busca funciona de ponta a ponta

1. O usuário digita na `BarraBusca`, dentro de `ListaNotas`.
2. Após um pequeno debounce, `ListaNotas` chama `NotaBuscaRapida.buscarOcorrencias(...)` para cada nota.
3. No Android, essa chamada vai até `NotaBuscaRapidaModule.kt`, que invoca a função nativa `nativeBuscarOcorrencias` via JNI.
4. `jni_bridge.cpp` converte as strings Java para `std::string` e chama `nota_dasi::buscarTextoRapido` (em `nota_busca_rapida.cpp`), retornando as posições onde o termo aparece.
5. As notas sem nenhuma ocorrência são filtradas da lista exibida.

Em plataformas onde o módulo nativo ainda não foi compilado (ex.: iOS ou ambiente de desenvolvimento sem rebuild), `NotaBuscaRapida.ts` usa automaticamente um fallback equivalente em JavaScript puro, para o app continuar funcional.

## Pré-requisitos

- Node.js 22+
- Java JDK 17+ (ou compatível com o Android Gradle Plugin em uso)
- Android SDK, com **NDK** e **CMake** instalados via SDK Manager (necessários para compilar `cpp/`)
- Um emulador Android configurado ou dispositivo físico conectado

## Como rodar

```bash
npm install
npm run android
```

O Gradle compila automaticamente a biblioteca nativa como parte do build do app — não é necessário nenhum passo manual de compilação do C++.

> **Atenção ao mexer no build nativo:** o `externalNativeBuild` do módulo `:app` aponta para `android/app/src/main/jni/CMakeLists.txt`, que primeiro inclui o CMake do próprio React Native (gerando a `libappmodules.so`) e só depois adiciona o nosso `cpp/`. Se você apontar direto para `cpp/CMakeLists.txt`, o React Native deixa de gerar a `libappmodules.so` e o app abre com **tela preta**. Veja os detalhes em `DOCUMENTACAO.md`, seção 2.4.

## Observações importantes

- `descriptografarTextoSimulado` (em `cpp/nota_busca_rapida.cpp`) é **uma simulação didática** (um deslocamento simples de bytes), não um algoritmo de criptografia real. Não deve ser usado como mecanismo de segurança em produção.
- O layout `android/app/src/main/res/layout/nota_header.xml` é uma referência estrutural de cabeçalho nativo; ele não é inflado pela `MainActivity` — a tela principal do app é renderizada inteiramente pelo React Native.
