# ---- Build Stage ----
FROM node:20-alpine AS build
WORKDIR /app

# 配置淘宝 npm 镜像（加速下载）
RUN npm config set registry https://registry.np.taobao.org

COPY package.json package-lock.json* ./
RUN npm ci --include=dev
COPY . .
RUN npx tsc -b && npx vite build

# ---- Production Stage ----
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
