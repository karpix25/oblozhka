FROM node:22-bookworm-slim AS base

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

ENV NODE_ENV=development
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci

FROM deps AS build

ARG VITE_API_URL=http://localhost:3000
ARG VITE_ADMIN_TOKEN=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_TOKEN=$VITE_ADMIN_TOKEN

RUN npm run prisma:generate
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runtime

COPY --from=build /app/package.json /app/package-lock.json /app/tsconfig.base.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/packages ./packages

CMD ["npm", "--workspace", "@covers/api", "run", "start"]
