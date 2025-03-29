FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Add default values for required environment variables as ARGs for flexibility
ARG PORT=80
ARG NODE_ENV=production
ARG GOOGLE_CLIENT_ID=3378649832-qp43a4q9ivfdu6olc92u2c6sckv10rde.apps.googleusercontent.com
ARG GOOGLE_CLIENT_SECRET=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
ARG BASE_URL=https://readinggroup.myplaceholder.in
ARG CORS_ORIGIN=https://readinggroup.myplaceholder.in
# MongoDB URI with proper CapRover service name (try multiple formats)
ARG MONGODB_URI=mongodb://root:florist@srv-captain--mongodb:27017/readinggroup?authSource=admin
ARG SESSION_SECRET=floristTamasha

# Set environment variables from ARGs
ENV PORT=${PORT}
ENV NODE_ENV=${NODE_ENV}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
ENV BASE_URL=${BASE_URL}
ENV CORS_ORIGIN=${CORS_ORIGIN}
ENV MONGODB_URI=${MONGODB_URI}
ENV SESSION_SECRET=${SESSION_SECRET}

EXPOSE 80

CMD ["node", "server.js"] 