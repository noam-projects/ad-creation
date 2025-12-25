FROM node:18-bullseye-slim

# 1. Install System Dependencies for Remotion (Chromium + FFMPEG)
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    git \
    && rm -rf /var/lib/apt/lists/*

# 2. Set Work Directory
WORKDIR /app

# 3. Install Dependencies
COPY package.json package-lock.json* ./
RUN npm install

# 4. Copy Source Code
COPY . .

# 5. Build the Next.js App
RUN npm run build

# 6. Expose Port (Next.js default)
EXPOSE 3000

# 7. Start the Server
CMD ["npm", "start"]
