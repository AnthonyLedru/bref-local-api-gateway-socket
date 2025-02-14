import WebSocket, { WebSocketServer } from "ws";
import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
  InvokeCommandOutput,
} from "@aws-sdk/client-lambda";
import { randomUUID } from "crypto";
import { parse } from "url";
import PQueue from "p-queue";
import express, { Application, Request, Response } from "express";

const TARGET = process.env.TARGET;
const LAMBDA_NAME = "function";
const DOMAIN_NAME = "localhost";
const API_ID = "mock-api-id";
const STAGE = "dev";

const client = new LambdaClient({
  region: "us-east-1",
  endpoint: TARGET,
});

const queue = new PQueue({ concurrency: 1 });

const connections = new Map<string, WebSocket>();

const wss = new WebSocketServer({ host: "0.0.0.0", port: 8000 });

console.log(`🚀 Mock WebSocket server running on ws://0.0.0.0:8000`);

wss.on("connection", async (ws, req) => {
  const connectionId = randomUUID();
  const parsedUrl = parse(req.url || "", true);
  const queryParams = parsedUrl.query;

  console.log(`🔗 New WebSocket connection: ${connectionId}`);

  connections.set(connectionId, ws);

  queue.add(() =>
    invokeLambda("$connect", "CONNECT", connectionId, null, queryParams)
  );

  ws.on("message", async (message) => {
    console.log(`📩 Received: ${message}`);

    queue.add(() =>
      invokeLambda(
        "$default",
        "MESSAGE",
        connectionId,
        message.toString(),
        queryParams
      )
    );
  });

  ws.on("close", async () => {
    console.log(`❌ Disconnected: ${connectionId}`);

    connections.delete(connectionId);

    queue.add(() =>
      invokeLambda("$disconnect", "DISCONNECT", connectionId, null, queryParams)
    );
  });
});

async function invokeLambda(
  routeKey: string,
  eventType: string,
  connectionId: string,
  body: string | null,
  queryStringParameters: Record<string, string | string[] | undefined>
) {
  const event = {
    requestContext: {
      routeKey,
      eventType,
      connectionId,
      domainName: DOMAIN_NAME,
      apiId: API_ID,
      stage: STAGE,
    },
    queryStringParameters: queryStringParameters,
    body: body || null,
    isBase64Encoded: false,
  };

  try {
    const result: InvokeCommandOutput = await client.send(
      new InvokeCommand({
        FunctionName: LAMBDA_NAME,
        Payload: Buffer.from(JSON.stringify(event)),
        InvocationType: InvocationType.RequestResponse,
      })
    );

    if (result.Payload) {
      const responsePayload = Buffer.from(result.Payload).toString();
      console.log("🖥 Lambda Response:", responsePayload);
    }
  } catch (error) {
    console.error("🔥 Lambda invocation failed:", error);
  }
}

const app: Application = express();

app.use(express.text());
app.use(express.json());

app.post(
  "/@connections/:connectionId",
  express.raw({ type: "*/*" }),
  (req: Request, res: Response) => {
    console.log("New message:", req.params.connectionId, req.body);

    const { connectionId } = req.params;

    const ws = connections.get(connectionId);

    if (!ws) {
      res
        .status(410)
        .json({ error: "GoneException: Connection no longer exists" });
    } else if (ws.readyState !== WebSocket.OPEN) {
      connections.delete(connectionId);
      res.status(410).json({ error: "GoneException: Connection is closed" });
    } else {
      let messageData: string;

      if (Buffer.isBuffer(req.body)) {
        messageData = req.body.toString("utf-8");
      } else {
        messageData = String(req.body);
      }

      try {
        ws.send(messageData);
        console.log(`📤 Sent message to ${connectionId}:`, messageData);
        res.status(200).json({ success: true });
      } catch (err) {
        console.error(`🔥 Error sending message to ${connectionId}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  }
);

app.get("/@connections/:connectionId", (req: Request, res: Response) => {
  console.log("Get connection:", req.params.connectionId);

  const { connectionId } = req.params;
  const ws = connections.get(connectionId);

  if (!ws) {
    res
      .status(410)
      .json({ error: "GoneException: Connection no longer exists" });
  } else if (ws.readyState !== WebSocket.OPEN) {
    connections.delete(connectionId);
    res.status(410).json({ error: "GoneException: Connection is closed" });
  } else {
    res.status(200).json({
      sourceIp: "127.0.0.1",
      userAgent: "Chrome",
      connectedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    });
  }
});

app.delete("/@connections/:connectionId", (req: Request, res: Response) => {
  console.log("Delete connection:", req.params.connectionId);

  const { connectionId } = req.params;
  const ws = connections.get(connectionId);

  if (ws) {
    ws.close();
    connections.delete(connectionId);
    console.log(`❌ Disconnected ${connectionId}`);
    res.status(200).json({ success: true });
  } else {
    res
      .status(410)
      .json({ error: "GoneException: Connection no longer exists" });
  }
});

app.listen(8001, () => {
  console.log(`📡 HTTP Server running on http://0.0.0.0:8001`);
});
