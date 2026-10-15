# Stage 1: Build TypeScript source
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json ./
RUN npm ci

# Copy configuration and source files
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

# Compile strict TypeScript to dist/
RUN npm run build

# Stage 2: Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled application from builder
COPY --from=builder /app/dist ./dist
# Copy Drizzle migrations for runtime/startup migration jobs
COPY drizzle/ ./drizzle/
# Copy startup entrypoint (runs migrations before starting the server)
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Run as non-privileged node user for container security
USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]

