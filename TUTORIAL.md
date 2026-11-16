# TUTORIAL — baixar e configurar o NotaDASI

Só os comandos. Para entender o código, veja [GUIA-DE-CODIGO.md](GUIA-DE-CODIGO.md);
para a visão geral do projeto, o [README.md](README.md).

---

## 1. Baixar

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

```bash
npm run dev
```

Abra **http://localhost:5173**.

> Se a porta estiver ocupada, o Vite sobe em 5174, 5175... — use a que ele
> imprimir no terminal.

Entre com uma das contas padrão:

| Conta | Senha | Perfil & Responsabilidade |
|---|---|---|
| `DASI` | `dasi` | **Trabalhador Prioritário** — cria/edita registros e tabelas principais (auditável) |
| `GERENTE - DGEO` | `gerente` | **Chefe DGEO** — cria campos/tabelas no ambiente; visualiza e declara comentários |
| `SECRETARIO` | `secretario` | **Secretaria** — auditoria completa, comentários institucionais e notas pessoais |

Outros comandos do alvo PC:

```bash
npm run dev:build      # build de produção em pc/dist/
npm run dev:preview    # serve o build de produção
```

---

## 3. Rodar via Docker (Container `notadasi`)

A aplicação já conta com `Dockerfile`, `docker-compose.yml` e `nginx.conf` configurados para ambiente de produção isolado e compatível com sub-rotas/proxy reverso da Prefeitura (ex.: `/notadasi/`):

```bash
# Subir o container nomeado "notadasi" na porta 5173
docker-compose up -d --build

# Verificar logs
docker logs -f notadasi

# Parar o serviço
docker-compose down
```

---

## 4. Banco de Dados PostgreSQL (Schema Isolado)

Na infraestrutura compartilhada da Prefeitura, sem permissão de criar banco dedicado:

```bash
# Executa a criação do schema isolado e tabelas auditáveis
psql -U usuario_prefeitura -d banco_compartilhado -f db/schema.sql
```

O script configura automaticamente `CREATE SCHEMA IF NOT EXISTS notadasi; SET search_path TO notadasi, public;` e ativa triggers para auditoria completa de qualquer alteração feita pelo operador DASI.

---

## 5. Rodar no Android

### 5.1 Pré-requisitos

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

### 5.2 Configurar as variáveis de ambiente (Windows, PowerShell)

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
setx PATH "$env:PATH;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:LOCALAPPDATA\Android\Sdk\emulator"
```

Feche e reabra o terminal depois do `setx`.

### 5.3 Instalar NDK e CMake pela linha de comando

```bash
sdkmanager "ndk;27.1.12297006" "cmake;3.22.1" "platform-tools" "platforms;android-35"
```

### 5.4 Subir um emulador

```bash
emulator -list-avds                       # lista os emuladores existentes
emulator -avd NotaDASI_Emulator           # sobe um deles
adb devices                               # confirme que aparece como "device"
```

### 5.5 Instalar e rodar

```bash
npm run android
```

O Gradle compila a biblioteca nativa automaticamente — não há passo manual de
compilação do C++.

---

## 6. Gerar o APK

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

## 7. Importar a planilha do levantamento

```bash
npm run importar-xlsx -- sua_planilha.xlsx --ts src/data/registros.gerado.ts
```

Enquanto `registros.gerado.ts` não existir, o app usa os dados de exemplo e
mostra "dados de exemplo" no subtítulo.

---

## 8. Verificar o projeto

```bash
npx jest --runInBand --forceExit           # testes unitários (Jest)
npm run dev:build                          # build web / PC
npx tsc --noEmit -p tsconfig.json          # tipos do alvo Android
npx tsc --noEmit -p pc/tsconfig.json       # tipos do alvo PC
```

---

## 9. Quando algo dá errado

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
