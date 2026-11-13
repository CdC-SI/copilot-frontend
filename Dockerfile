# Image de production : l'application est construite en amont (npm run build:prod),
# puis servie par l'image nginx ZAS (non-root, port 8080, CSP, endpoint /health).
FROM docker-commons.zas.admin.ch/zas/imagebase/application/nginx:ubi-angular-2.10.1

ENV CONTEXT_PATH=/
# Élément racine de l'application (src/index.html)
ENV APP_ROOT=zco-root

COPY ./dist/zas-eak-copilot-frontend/browser/. /usr/share/nginx/html/
