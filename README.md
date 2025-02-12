This project lets you run Websocket Lambda applications locally.

This is inspired from https://github.com/brefphp/local-api-gateway that only supports HTTP.

## Usage

This project publishes a anthonyledru/bref-local-api-gateway-socket Docker image.

This image creates:

- a local API Gateway (i.e. WebSocket server) that forwards WS requests to your Lambda function running in Docker.
- a local HTTP server that can be used to send messages or manually disconnect a WebSocket client.

The only thing it needs is a TARGET environment variable that contains the endpoint of your Lambda function: http://<host>:<port> (the default port of Lambda RIE is 8080).

### Example

Example of `docker-compose.yml`:

```yaml
version: "3.5"

services:
  # This container runs API Gateway locally
  websocket-server:
    image: anthonyledru/bref-local-api-gateway-socket
    ports:
      # The port of the local API Gateway
      - "8000:8000"
      # The port of the local HTTP server
      - "8001:8001"
    environment:
      # http://<host>:<port> -> the host here is "websocket-handler" because that's the name of the Lambda container
      - TARGET=http://websocket-handler:8080
    depends_on:
      - websocket-handler

  # Example of container running AWS Lambda locally
  websocket-handler:
    image: bref/php-84
    # The command should contain the Lambda Websocket handler
    command: public/index.php
    volumes:
      - .:/var/task:ro
```
