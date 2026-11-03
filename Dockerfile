FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 DB_FILE=/data/arcade.db
EXPOSE 8080
VOLUME ["/data"]
CMD ["node", "--no-warnings", "server/server.js"]
