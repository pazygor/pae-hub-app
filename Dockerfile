# ─────────────────────────────────────────────────────────────────────────────
# M1 PAE Hub — App (Vite + React) servido por nginx
# VITE_API_URL é "assado" no build. Padrão "/api" (relativo) → o nginx faz o
# proxy de /api e /socket.io para o container da API, sem CORS nem IP fixo.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ─── runtime: nginx estático ─────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
