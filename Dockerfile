# ============================================================================
# Dockerfile para o NotaDASI
# Aplicação Municipal de Diagnóstico de Adesão ao SIG — Porto Velho (RO)
# Container: notadasi
# ============================================================================

# Stage 1: Build da aplicação Web
FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifestos de pacotes
COPY package.json package-lock.json ./

# Instalação limpa de dependências (com espelho Yarn como fallback para redes restritas)
RUN npm ci --no-audit --no-fund || npm install --registry https://registry.yarnpkg.com

# Copia o código fonte
COPY . .

# Compilação do alvo web
RUN npm run dev:build

# Stage 2: Servidor Web Nginx de produção ultraleve
FROM nginx:alpine AS runner

# Copia configuração otimizada do Nginx com suporte a SPA e subpath
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os artefatos compilados
COPY --from=builder /app/pc/dist /usr/share/nginx/html

# Também disponibiliza os mesmos arquivos sob /notadasi para suporte nativo a subcaminho
RUN mkdir -p /usr/share/nginx/html/notadasi && \
    cp -r /usr/share/nginx/html/* /usr/share/nginx/html/notadasi/ 2>/dev/null || true

EXPOSE 80

# Healthcheck do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
