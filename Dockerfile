FROM node:20

# Fake AWS credentials so that the Lambda client works
ENV AWS_ACCESS_KEY_ID=fake
ENV AWS_SECRET_ACCESS_KEY=fake

WORKDIR /app
COPY package.json package.json
RUN npm install --production
COPY dist dist

EXPOSE 8000

CMD ["npm", "run", "start"]