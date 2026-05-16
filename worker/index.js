import fs from 'fs/promises'
import path from 'path'
import { receiveMessage, deleteMessage } from '../shared/queue.js'
import { updateStatus } from '../shared/state.js'
import { createBucket, deleteBucket } from '../shared/s3.js'

import 'dotenv/config'

const OUTPUT_DIR = './outputs'
await fs.mkdir(OUTPUT_DIR, { recursive: true })

// async function executeTask({ instanceId, filename, content }) {
//     await updateStatus(instanceId, { status: 'IN_PROGRESS' })

//     // Simulate slight delay like a real provisioning call would have
//     await new Promise(r => setTimeout(r, 2000))

//     // Write the file to disk — this is the "provisioning" task
//     const filepath = path.join(OUTPUT_DIR, filename)
//     await fs.writeFile(filepath, content, 'utf-8')

//     console.log(`[worker] wrote file → ${filepath}`)
// }

// ── task handlers ──

async function handleWriteFile({ instanceId, filename, content }) {
    await updateStatus(instanceId, { status: 'IN_PROGRESS' })
    await new Promise(r => setTimeout(r, 2000))
    await fs.writeFile(path.join(OUTPUT_DIR, filename), content, 'utf-8')
    await updateStatus(instanceId, { status: 'COMPLETE' })
    console.log(`[worker] file written → ${filename}`)
}

async function handleS3Bucket({ instanceId, bucketName, region, versioning }) {
    await updateStatus(instanceId, { status: 'IN_PROGRESS' })

    const details = await createBucket({ bucketName, region, versioning })

    await updateStatus(instanceId, {
        status: 'COMPLETE',
        details   // stores ARN, region, versioning back into DynamoDB
    })

    console.log(`[worker] S3 bucket created → ${details.arn}`)
}

async function handleDeleteS3Bucket({ instanceId, bucketName }) {
    await updateStatus(instanceId, { status: 'IN_PROGRESS' })

    const details = await deleteBucket({
        bucketName
    })

    await updateStatus(instanceId, { status: 'COMPLETE', details })
    console.log(`[worker] S3 bucket deleted → ${bucketName}`)
}
// ── task router ──

async function executeTask(payload) {
    switch (payload.task) {
        case 'write_file':
            return handleWriteFile(payload)
        case 's3_bucket':
            return handleS3Bucket(payload)
        case 'delete_s3_bucket':
            return handleDeleteS3Bucket(payload)
        default:
            throw new Error(`Unknown task type: ${payload.task}`)
    }
}



async function poll() {
    console.log('[worker] started, polling SQS...')

    while (true) {
        const message = await receiveMessage()   // blocks up to 20s waiting

        if (!message) {
            console.log('[worker] no messages, waiting...')
            continue
        }

        const payload = JSON.parse(message.Body)
        console.log(`[worker] picked up job: ${payload.instanceId}`)

        try {
            await executeTask(payload)
            await updateStatus(payload.instanceId, { status: 'COMPLETE' })
        } catch (err) {
            console.error(`[worker] task failed:`, err.message)
            await updateStatus(payload.instanceId, {
                status: 'FAILED',
                error: err.message
            })
        }

        // Delete AFTER processing — if worker crashes before this, SQS re-delivers
        await deleteMessage(message.ReceiptHandle)
    }
}

poll()