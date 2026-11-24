FROM node:20-alpine AS builder

WORKDIR /app

# The build evaluates rewrites and prerenders route shells. Without
# AUTH_SECRET the session module throws during build; without NEXT_PUBLIC_*
# the public env values are missing from the bundle. Values are supplied as
# build args (see docker-compose.yml) so the image matches its deployment.
ARG AUTH_SECRET
ARG BACKEND_URL=http://backend:5000
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_CARTO_BASMAPS_KEY=
ENV AUTH_SECRET=$AUTH_SECRET \
    BACKEND_URL=$BACKEND_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CARTO_BASMAPS_KEY=$NEXT_PUBLIC_CARTO_BASMAPS_KEY

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/next.config.mjs ./
# next.config.mjs imports ./src/lib/backend-url.ts at runtime (server start),
# so the source module must exist in the runner image too.
COPY --from=builder /app/src ./src

EXPOSE 3000

CMD ["npm", "start"]
