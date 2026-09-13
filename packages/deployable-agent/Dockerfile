FROM node:20-alpine AS base

WORKDIR /app

COPY package.json ./
RUN npm install -g pnpm && pnpm install

COPY . .

EXPOSE 8200

ENV PORT=8200
ENV SWARMPROOF_API_URL=https://swarm-proof-api.vercel.app

CMD ["pnpm", "start"]
