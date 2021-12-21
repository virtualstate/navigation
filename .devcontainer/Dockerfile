ARG VARIANT="16-buster"
FROM mcr.microsoft.com/vscode/devcontainers/javascript-node:0-${VARIANT}
USER node
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx -q playwright install \
     && npx playwright install-deps
