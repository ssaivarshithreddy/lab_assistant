# Node.js Express Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose API port
EXPOSE 5000

# Start server
CMD ["node", "index.js"]
