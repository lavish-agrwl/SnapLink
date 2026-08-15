FROM node:20-alpine
WORKDIR /usr/src/app

# Install dependencies (package.json may be updated later)
COPY package.json package-lock.json* ./
RUN npm set progress=false && npm config set depth 0
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm i --omit=dev; fi

COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["node", "./src/api/index.js"]