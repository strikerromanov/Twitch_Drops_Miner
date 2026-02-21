#!/bin/sh

# Twitch Farm Pro Entrypoint
# This script ensures the environment is ready and starts the server.

echo "Starting Twitch Farm Pro..."

# In a real Docker environment, you might run migrations here.
# Our server.ts handles SQLite initialization automatically.

# Start the application
# We use 'npm run dev' in this environment to support TS execution via tsx.
# In a pure production Docker image, you would use 'npm start'.
npm run dev
