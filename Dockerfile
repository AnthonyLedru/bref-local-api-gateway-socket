FROM node:20

# Fake AWS credentials so that the Lambda client works
ENV AWS_ACCESS_KEY_ID=fake
ENV AWS_SECRET_ACCESS_KEY=fake

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install
RUN npm install -g typescript

COPY . .

RUN tsc

EXPOSE 8000

CMD ["npm", "run", "start"]