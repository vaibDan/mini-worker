import express from 'express'
import { v4 as uuid } from 'uuid'
import { sendMessage } from '../shared/queue.js'
import { createInstance, getStatus } from '../shared/state.js'
import 'dotenv/config'

const app = express()
app.use(express.json())

// ── Submit a provisioning job ──
app.put('/v2/service_instances/:id', async (req, res) => {
    const instanceId = req.params.id
    const { filename, content } = req.body
    console.log(req.body)

    if (!filename || !content) {
        return res.status(400).json({ error: 'filename and content are required' })
    }

    // Write initial state to DynamoDB
    await createInstance(instanceId, { filename, content, task: 'write_file' })

    // Drop task into SQS — API's job ends here
    await sendMessage({ instanceId, filename, content, task: 'write_file' })

    // OSB spec: 202 Accepted for async operations
    res.status(202).json({
        instance_id: instanceId,
        status: 'PENDING',
        message: 'Job accepted. Poll /last_operation for status.'
    })
})

app.put('/v2/service_instances/s3/:id', async (req, res) => {
    const instanceId = req.params.id
    const { bucketName, region, versioning } = req.body
    console.log(req.body)


    if (!bucketName) {
        return res.status(400).json({ error: 'bucketName is required' })
    }

    await createInstance(instanceId,
        {
            task: 's3_bucket',
            bucketName,
            region: region ? region : process.env.AWS_REGION,
            versioning: versioning ? versioning : false
        }
    )

    await sendMessage({
        instanceId,
        task: 's3_bucket',
        bucketName,
        region: region ? region : process.env.AWS_REGION,
        versioning: versioning ? versioning : false
    })

    res.status(202).json({
        instance_id: instanceId,
        status: 'PENDING',
        message: `S3 bucket '${bucketName}' provisioning started.`
    })
})


// DELETE /v2/service_instances/s3/:id
app.delete('/v2/service_instances/s3/:id', async (req, res) => {
    const instanceId = req.params.id
    const { bucketName } = req.body

    if (!bucketName) {
        return res.status(400).json({ error: 'bucketName is required' })
    }

    await createInstance(instanceId, {
        task: 'delete_s3_bucket',
        bucketName
    })

    await sendMessage({
        instanceId,
        task: 'delete_s3_bucket',
        bucketName
    })

    res.status(202).json({
        instance_id: instanceId,
        status: 'PENDING',
        message: `S3 bucket '${bucketName}' deletion started.`
    })
})


// ── Poll for status ──
app.get('/v2/service_instances/:id/last_operation', async (req, res) => {
    const item = await getStatus(req.params.id)

    if (!item) return res.status(404).json({ error: 'Instance not found' })

    res.json({
        instance_id: req.params.id,
        status: item.status,         // PENDING | IN_PROGRESS | COMPLETE | FAILED
        filename: item.filename,
        details: item.details ?? null,
        error: item.error ?? null
    })
})

app._router.stack
    .filter(r => r.route)
    .forEach(r => {
        const methods = Object.keys(r.route.methods).join(', ').toUpperCase()
        console.log(`${methods} ${r.route.path}`)
    })

app.listen(process.env.PORT, () => {
    console.log(`Broker API running on :${process.env.PORT}`)
})