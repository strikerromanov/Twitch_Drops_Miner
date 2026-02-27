# Multi-stage build for optimized production image
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Install Playwright browsers and system dependencies
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Install system libraries for Playwright
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates fonts-liberation libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 \
    libnss3 libwayland-client0 libxcomposite1 libxdamage1 \
    libxfixes3 libxkbcommon0 libxrandr2 xdg-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install production dependencies with tsx runtime
RUN npm ci && npm cache clean --force

# Copy built frontend from builder
COPY --from=builder /app/dist ./dist

# Copy TypeScript source (server.ts uses imports from src/)
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src

# Copy Playwright browsers and cache from builder
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Set environment for Playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/stats', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server with tsx runtime
CMD ["npx", "tsx", "server.ts"]
