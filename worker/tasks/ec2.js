import { launchInstance, stopInstance, terminateInstance } from '../../shared/ec2.js'
import { updateStatus } from '../../shared/state.js'

export async function handleEC2(payload) {
    switch (payload.task) {
        case 'launch_ec2': return handleLaunch(payload)
        case 'stop_ec2': return handleStop(payload)
        case 'terminate_ec2': return handleTerminate(payload)
        default: throw new Error(`Unknown EC2 task: ${payload.task}`)
    }
}

async function handleLaunch({ instanceId, amiId, instanceType, region }) {
    // console.log('[ec2] payload received:', JSON.stringify(payload)) 
    await updateStatus(instanceId, { status: 'IN_PROGRESS' })

    const details = await launchInstance({ amiId, instanceType, region })

    await updateStatus(instanceId, { status: 'COMPLETE', details })
    console.log(`[worker] EC2 launched → ${details.instanceId} (${details.publicIp})`)
}

async function handleStop({ instanceId, ec2InstanceId, region }) {
    await updateStatus(instanceId, { status: 'IN_PROGRESS' })

    const details = await stopInstance({ instanceId: ec2InstanceId, region })

    await updateStatus(instanceId, { status: 'COMPLETE', details })
    console.log(`[worker] EC2 stopped → ${details.instanceId}`)
}

async function handleTerminate({ instanceId, ec2InstanceId, region }) {
    await updateStatus(instanceId, { status: 'IN_PROGRESS' })

    const details = await terminateInstance({ instanceId: ec2InstanceId, region })

    await updateStatus(instanceId, { status: 'COMPLETE', details })
    console.log(`[worker] EC2 terminated → ${details.instanceId}`)
}