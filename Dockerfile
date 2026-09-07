FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY server ./server
COPY client ./client

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server/server.js"]