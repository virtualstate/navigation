ARG VARIANT="16-buster"
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:0-${VARIANT}

WORKDIR /usr/app

USER root
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && npm i -D @playwright/test

USER node
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/app/.ms-playwright
RUN npx -q playwright install \
     && npx playwright install-deps
