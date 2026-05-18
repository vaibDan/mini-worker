import { receiveMessage, deleteMessage } from '../shared/queue.js'
import { updateStatus } from '../shared/state.js'
import { route } from './router.js'   // ← make sure this import exists
import 'dotenv/config'

async function poll() {
    console.log('[worker] started, polling SQS...')

    // while (true) {
    //     const message = await receiveMessage()
    //     if (!message) continue

    //     const payload = JSON.parse(message.Body)
    //     console.log(`[worker] picked up job: ${payload.instanceId}`)

    //     try {
    //         await route(payload)             // ← route() not executeTask()
    //         console.log(payload)
    //     } catch (err) {
    //         console.error(`[worker] task failed:`, err.message)
    //         await updateStatus(payload.instanceId, {
    //             status: 'FAILED',
    //             error: err.message
    //         })
    //     }
    while (true) {
        const message = await receiveMessage()
        if (!message) continue

        const payload = JSON.parse(message.Body)
        const receiveCount = parseInt(message.Attributes?.ApproximateReceiveCount ?? '1')

        console.log(`[worker] picked up job: ${payload.instanceId} (attempt ${receiveCount}/3)`)

        try {
            await route(payload)
            await deleteMessage(message.ReceiptHandle)
        } catch (err) {
            console.error(`[worker] task failed (attempt ${receiveCount}/3):`, err.message)

            if (receiveCount >= 3) {
                console.error(`[worker] job exhausted retries, moving to DLQ: ${payload.instanceId}`)
                await updateStatus(payload.instanceId, {
                    status: 'FAILED',
                    error: `Exhausted retries: ${err.message}`
                })
            }
            // don't delete — let SQS re-deliver or send to DLQ
            await deleteMessage(message.ReceiptHandle)
        }
    }

}

poll()