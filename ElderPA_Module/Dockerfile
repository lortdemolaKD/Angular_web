# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build (production; increase Node memory for build)
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN npm run build

# Run stage: serve the app with Node (Angular SSR)
FROM node:20-alpine AS runner

WORKDIR /app

# Production deps only (needed for SSR server)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# Server listens on PORT (default 4000)
ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/ElderPA_Module/server/server.mjs"]
