# Momentum's sync server. Build from the repository's root:
#   docker build -f server/Dockerfile -t momentum-sync .
#   docker run -p 8787:8787 -v momentum-sync:/data momentum-sync
# and put it behind HTTPS before opening it to the internet.
FROM node:22-alpine
WORKDIR /app
COPY server/*.ts ./server/
RUN rm -f ./server/*.test.ts && mkdir /data && chown node:node /data
ENV HOST=0.0.0.0 PORT=8787 MOMENTUM_SYNC_DB=/data/momentum-sync.db
USER node
VOLUME /data
EXPOSE 8787
CMD ["node", "--disable-warning=ExperimentalWarning", "server/main.ts", "serve"]
