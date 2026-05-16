import { receiveMessage, deleteMessage } from '../shared/queue.js'
import { updateStatus } from '../shared/state.js'
import { route } from './router.js'   // ← make sure this import exists
import 'dotenv/config'

async function poll() {
    console.log('[worker] started, polling SQS...')

    while (true) {
        const message = await receiveMessage()
        if (!message) continue

        const payload = JSON.parse(message.Body)
        console.log(`[worker] picked up job: ${payload.instanceId}`)

        try {
            await route(payload)             // ← route() not executeTask()
            console.log(payload)
        } catch (err) {
            console.error(`[worker] task failed:`, err.message)
            await updateStatus(payload.instanceId, {
                status: 'FAILED',
                error: err.message
            })
        }

        await deleteMessage(message.ReceiptHandle)
    }
}

poll()