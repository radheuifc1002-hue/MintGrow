# MintGrow Telegram Bot — Railway Deployment
# This Dockerfile serves the Telegram bot webhook via a lightweight Node.js server
# The Expo app itself is deployed separately (Expo Go / EAS Build)

FROM node:20-alpine

WORKDIR /app

# Install dependencies for the webhook server
RUN npm init -y && \
    npm install express cors dotenv @supabase/supabase-js node-fetch

# Copy webhook server
COPY railway/bot-server.js ./bot-server.js

EXPOSE 3000

CMD ["node", "bot-server.js"]
