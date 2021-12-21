ARG VARIANT="16-buster"
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:0-${VARIANT}
USER node
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && npm i -D @playwright/test playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install-deps
