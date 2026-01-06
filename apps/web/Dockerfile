FROM node:24.12-alpine AS builder

WORKDIR /app

COPY package*.json ./

ARG VITE_SERVER_URL

ENV VITE_SERVER_URL=$VITE_SERVER_URL

RUN npm install 

COPY . .

RUN npm run build

# EXPOSE 4173

# CMD ["npm", "run", "preview"]

FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
