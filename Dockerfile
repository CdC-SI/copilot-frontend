FROM node:alpine
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN rm -rf /usr/src/app/node_modules
RUN npm install -g @angular/cli
RUN npm install

CMD ["ng", "serve", "--host", "0.0.0.0", "--configuration", "production"]
