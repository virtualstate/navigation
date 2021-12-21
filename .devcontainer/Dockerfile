ARG VARIANT="16-buster"
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:0-${VARIANT}

WORKDIR /usr/app

USER root

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/app/.ms-playwright
RUN mkdir -p /usr/app/.ms-playwright

RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && npm i -D @playwright/test

USER node
RUN npx -q playwright install \
     && npx playwright install-deps
