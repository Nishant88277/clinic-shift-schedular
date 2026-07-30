FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NEXTAUTH_SECRET="docker-dev-secret-change-me"

RUN npx prisma generate && npx prisma db push && npx tsx prisma/seed.ts && npm run build

EXPOSE 3000
CMD ["npm", "start"]
