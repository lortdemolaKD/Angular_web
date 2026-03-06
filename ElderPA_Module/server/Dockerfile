# Backend API (auth, companies, locations, audits, etc.)
FROM node:20-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src
# Optional: persist uploads via volume; ensure dir exists
RUN mkdir -p uploads/avatars

EXPOSE 3000

ENV PORT=3000
CMD ["node", "src/index.js"]
