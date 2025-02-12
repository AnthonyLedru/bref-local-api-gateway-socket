import { WebSocketServer } from "ws";
import {
    LambdaClient,
    InvokeCommand,
    InvocationType,
    InvokeCommandOutput,
} from "@aws-sdk/client-lambda";
import { randomUUID } from "crypto";

const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS || "0.0.0.0";
const LISTEN_PORT = process.env.LISTEN_PORT
    ? Number(process.env.LISTEN_PORT)
    : 8000;

const TARGET = process.env.TARGET;
const LAMBDA_NAME = "function";

const DOMAIN_NAME = "localhost";
const API_ID = "mock-api-id";
const STAGE = "dev";

const client = new LambdaClient({
    region: "us-east-1",
    endpoint: TARGET,
});

const wss = new WebSocketServer({ host: LISTEN_ADDRESS, port: LISTEN_PORT });

console.log(
    `🚀 Mock WebSocket server running on ws://${LISTEN_ADDRESS}:${LISTEN_PORT}`
);

wss.on("connection", async (ws, req) => {
    const connectionId = randomUUID();
    console.log(`🔗 New WebSocket connection: ${connectionId}`);

    await invokeLambda("$connect", "CONNECT", connectionId, null);

    ws.on("message", async (message) => {
        console.log(`📩 Received: ${message}`);

        await invokeLambda(
            "$default",
            "MESSAGE",
            connectionId,
            message.toString()
        );
    });

    ws.on("close", async () => {
        console.log(`❌ Disconnected: ${connectionId}`);

        await invokeLambda("$disconnect", "DISCONNECT", connectionId, null);
    });
});

async function invokeLambda(
    routeKey: string,
    eventType: string,
    connectionId: string,
    body: string | null
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
