# Multi-stage Dockerfile for React/Vite Frontend
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage with Vite hot reloading
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production build stage
FROM base AS build
RUN npm install
COPY . .
RUN npm run build

# Production release stage served with high-performance Nginx
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
