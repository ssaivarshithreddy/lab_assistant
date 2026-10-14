# Node.js Express Backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --omit=dev

# Copy all backend source code
COPY . .

# Expose API port
EXPOSE 5000

# Start Express server
CMD ["node", "index.js"]
