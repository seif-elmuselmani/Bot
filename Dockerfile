# Use official lightweight Node.js 20 image
FROM node:20-slim

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose port (Render/Koyeb/Hugging Face use this port for health checks)
EXPOSE 7860

# Start the application
CMD ["npm", "start"]
