FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY src ./src

USER node
EXPOSE 3001

CMD ["node", "src/server.js"]
