FROM node:20-alpine

WORKDIR /app
COPY server.mjs /app/server.mjs

ENV HERMES_WEB_ROOT=/opt/data/workspace/web
ENV HERMES_WEB_BIND=0.0.0.0
ENV HERMES_WEB_CONTAINER_PORT=4173

EXPOSE 4173
CMD ["node", "/app/server.mjs"]
