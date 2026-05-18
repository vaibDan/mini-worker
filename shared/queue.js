import {
    SQSClient, SendMessageCommand,
    ReceiveMessageCommand, DeleteMessageCommand
} from '@aws-sdk/client-sqs'
import 'dotenv/config'

const client = new SQSClient({ region: process.env.AWS_REGION })
const QUEUE_URL = process.env.SQS_QUEUE_URL

export async function sendMessage(payload) {
    await client.send(new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(payload)
    }))
}

export async function receiveMessage() {
    const res = await client.send(new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        WaitTimeSeconds: 20,      // long-polling — key for efficiency
        MaxNumberOfMessages: 1,
        AttributeNames: ['ApproximateReceiveCount']
    }))
    return res.Messages?.[0] ?? null
}

export async function deleteMessage(receiptHandle) {
    await client.send(new DeleteMessageCommand({
        QueueUrl: QUEUE_URL,
        ReceiptHandle: receiptHandle
    }))
}