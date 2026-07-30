FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Bake a seeded SQLite DB into the image (good for take-home demos)
ENV DATABASE_URL="file:/app/prisma/dev.db"
RUN npx prisma generate && npx prisma db push && npx tsx prisma/seed.ts && npm run build

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Runtime secrets/URL should be set by the host (Render/Fly), not baked in
CMD ["npm", "start"]
