FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production
ENV PORT=2567
USER node
EXPOSE 2567
CMD ["node", "--import", "tsx", "src/server/online/start.ts"]
