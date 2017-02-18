# Use following version of Node as the base image
FROM node:6

# Set work directory for run/cmd
WORKDIR /app

ARG GITHUB_USER_NAME
ENV GITHUB_USER_NAME ${GITHUB_USER_NAME}

ARG GITHUB_AUTH_TOKEN
ENV GITHUB_AUTH_TOKEN ${GITHUB_AUTH_TOKEN}

# Copy package.json into work directory and install dependencies
COPY package.json /app/package.json
RUN npm install

# Copy everthing else in work directory
COPY . /app

# Expose server port
EXPOSE 3000

# Run node
CMD ["node", "/app/index.js"]
