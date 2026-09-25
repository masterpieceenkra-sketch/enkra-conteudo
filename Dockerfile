# ---- build ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# variáveis públicas do Vite entram no build (a chave publishable é pública por desenho)
ARG VITE_APP=content
ARG VITE_SUPABASE_URL=
ARG VITE_SUPABASE_PUBLISHABLE_KEY=
ARG VITE_LAUNCH_ID=
ENV VITE_APP=$VITE_APP VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY VITE_LAUNCH_ID=$VITE_LAUNCH_ID
RUN npm run build

# ---- runtime: nginx não-root, só arquivos estáticos ----
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
# a imagem já roda como uid 101 (nginx); reafirmado por clareza
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
