# ---- Build Stage ----
FROM node:20-alpine AS build
WORKDIR /app

# 配置 npm 国内镜像（加速下载）
RUN npm config set registry https://registry.npmmirror.com

COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
