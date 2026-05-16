import {
    EC2Client,
    RunInstancesCommand,
    StopInstancesCommand,
    TerminateInstancesCommand,
    DescribeInstancesCommand
} from '@aws-sdk/client-ec2'

// ── launch ──
export async function launchInstance({ amiId, instanceType, region }) {
    const client = new EC2Client({ region })

    const res = await client.send(new RunInstancesCommand({
        ImageId: amiId,
        InstanceType: instanceType,
        MinCount: 1,
        MaxCount: 1,
        TagSpecifications: [{
            ResourceType: 'instance',
            Tags: [{ Key: 'provisioned-by', Value: 'mini-broker' }]
        }]
    }))

    const instanceId = res.Instances[0].InstanceId

    // AWS state is async — poll until running
    const details = await waitForState(client, instanceId, 'running', region)

    return details
}

// ── stop ──
export async function stopInstance({ instanceId, region }) {
    const client = new EC2Client({ region })

    await client.send(new StopInstancesCommand({
        InstanceIds: [instanceId]
    }))

    const details = await waitForState(client, instanceId, 'stopped', region)
    return details
}

// ── terminate ──
export async function terminateInstance({ instanceId, region }) {
    const client = new EC2Client({ region })

    await client.send(new TerminateInstancesCommand({
        InstanceIds: [instanceId]
    }))

    const details = await waitForState(client, instanceId, 'terminated', region)
    return details
}

// ── internal: poll until target state ──
async function waitForState(client, instanceId, targetState, region, timeoutMs = 600000) {
    const start = Date.now()

    while (true) {
        if (Date.now() - start > timeoutMs) {
            throw new Error(`Timeout waiting for instance ${instanceId} to reach ${targetState}`)
        }

        const res = await client.send(new DescribeInstancesCommand({
            InstanceIds: [instanceId]
        }))

        const instance = res.Reservations[0]?.Instances[0]
        const state = instance?.State?.Name

        console.log(`[ec2] ${instanceId} → ${state}`)

        if (state === targetState) {
            return {
                instanceId,
                state,
                publicIp: instance.PublicIpAddress ?? null,
                privateIp: instance.PrivateIpAddress ?? null,
                region
            }
        }

        // don't hammer the API — wait 5s between polls
        await new Promise(r => setTimeout(r, 5000))
    }
}