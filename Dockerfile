# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Install Playwright browsers (skip install-deps as we use Alpine)
RUN npx playwright install chromium

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install necessary system libraries for Playwright
RUN apk add --no-cache \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    woff2 \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production && npm cache clean --force

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy TypeScript server files and modules
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/point-claiming.ts ./
COPY --from=builder /app/drop-scraping.ts ./
COPY --from=builder /app/websocket-server.ts ./
COPY --from=builder /app/multi-account-coordinator.ts ./
COPY --from=builder /app/backup-service.ts ./

# Copy Playwright browsers and cache from builder (only ms-playwright exists)
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Set environment for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy other necessary files
COPY --from=builder /app/index.html ./
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/tsconfig.json ./

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/stats', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["npm", "start"]
