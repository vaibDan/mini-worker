import { createBucket, deleteBucket } from '../../shared/s3.js'
import { updateStatus } from '../../shared/state.js'

export async function handleS3(payload) {
    switch (payload.task) {
        case 's3_bucket': return handleCreate(payload)
        case 'delete_s3_bucket': return handleDelete(payload)
        default: throw new Error(`Unknown S3 task: ${payload.task}`)
    }
}

async function handleCreate({ instanceId, bucketName, region, versioning }) {
    await updateStatus(instanceId, { status: 'IN_PROGRESS' })
    const details = await createBucket({ bucketName, region, versioning })
    await updateStatus(instanceId, { status: 'COMPLETE', details })
    console.log(`[worker] S3 created → ${details.arn}`)
}

async function handleDelete({ instanceId, bucketName }) {
    await updateStatus(instanceId, { status: 'IN_PROGRESS' })
    const details = await deleteBucket({ bucketName })
    await updateStatus(instanceId, { status: 'COMPLETE', details })
    console.log(`[worker] S3 deleted → ${bucketName}`)
}