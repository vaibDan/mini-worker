import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
    DynamoDBDocumentClient, PutCommand,
    GetCommand, UpdateCommand
} from '@aws-sdk/lib-dynamodb'
import 'dotenv/config'

const dynamo = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION })
)
const TABLE = process.env.DYNAMO_TABLE

export async function createInstance(instanceId, data) {
    await dynamo.send(new PutCommand({
        TableName: TABLE,
        Item: { instance_id: instanceId, status: 'PENDING', ...data, createdAt: Date.now() }
    }))
}

export async function getStatus(instanceId) {
    const res = await dynamo.send(new GetCommand({
        TableName: TABLE,
        Key: { instance_id: instanceId }
    }))
    return res.Item ?? null
}

export async function updateStatus(instanceId, updates) {
    const entries = Object.entries(updates)
    const expr = entries.map((_, i) => `#k${i} = :v${i}`).join(', ')
    const names = Object.fromEntries(entries.map(([k], i) => [`#k${i}`, k]))
    const values = Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v]))

    await dynamo.send(new UpdateCommand({
        TableName: TABLE,
        Key: { instance_id: instanceId },
        UpdateExpression: `SET ${expr}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values
    }))
}