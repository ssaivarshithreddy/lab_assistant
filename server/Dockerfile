# Node.js Express Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy root package.json and package-lock.json
COPY package*.json ./
RUN npm install --omit=dev

# Copy server code and middlewares
COPY server ./server
COPY middlewares ./middlewares

# Set working directory to server
WORKDIR /app/server

# Expose API port
EXPOSE 5000

# Start Express server
CMD ["node", "index.js"]
