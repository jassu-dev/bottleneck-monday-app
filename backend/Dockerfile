# Multi-stage Dockerfile for Node.js Backend
FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package*.json ./

# Development stage for local live reload
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 8080
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS build
RUN npm install
COPY . .
RUN npm run build

# Production release stage
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
