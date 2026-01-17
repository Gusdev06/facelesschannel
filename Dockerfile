# Base image with Node.js (usando bookworm que é mais estável)
FROM node:20-bookworm-slim

# Install FFmpeg and build tools with retry logic
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    make \
    g++ \
    || (apt-get update && apt-get install -y --no-install-recommends ffmpeg python3 make g++) \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create output directories
RUN mkdir -p output/audio output/images output/subtitles output/thumbnails output/videos

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/main.js"]