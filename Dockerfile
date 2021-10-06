# Use following version of Node as the base image
FROM node:16-slim

# Set work directory for run/cmd
WORKDIR /app

# Copy package.json into work directory and install dependencies
COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
RUN npm install --production
RUN npm install -g pino-socket@3

# Copy everthing else in work directory
COPY . /app

# Expose server port
EXPOSE 3000

# Run node
CMD node index.js | pino-socket -a $PINO_SOCKET_ADDRESS -m $PINO_SOCKET_MODE -p $PINO_SOCKET_PORT

