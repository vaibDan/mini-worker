import { handleEC2 } from './tasks/ec2.js'
import { handleS3 } from './tasks/s3.js'

const handlers = {
    s3_bucket: handleS3,
    delete_s3_bucket: handleS3,
    launch_ec2: handleEC2,
    stop_ec2: handleEC2,
    terminate_ec2: handleEC2,
}

export async function route(payload) {
    const handler = handlers[payload.task]
    if (!handler) throw new Error(`Unknown task: ${payload.task}`)
    return handler(payload)
}