import {
    S3Client,
    CreateBucketCommand,
    PutBucketVersioningCommand,
    PutBucketTaggingCommand,
    DeleteBucketCommand,
    ListObjectsV2Command,
    ListObjectVersionsCommand,
    DeleteObjectsCommand,
    GetBucketLocationCommand
} from '@aws-sdk/client-s3'
import 'dotenv/config'

const client = new S3Client({ region: process.env.AWS_REGION })

export async function createBucket({ bucketName, region, versioning }) {

    // us-east-1 is special — no LocationConstraint allowed
    const createParams = {
        Bucket: bucketName,
        ...(region !== 'us-east-1' && {
            CreateBucketConfiguration: { LocationConstraint: region }
        })
    }

    await client.send(new CreateBucketCommand(createParams))

    // Enable versioning if requested
    if (versioning) {
        await client.send(new PutBucketVersioningCommand({
            Bucket: bucketName,
            VersioningConfiguration: { Status: 'Enabled' }
        }))
    }

    // Tag it so you know it was broker-provisioned
    await client.send(new PutBucketTaggingCommand({
        Bucket: bucketName,
        Tagging: {
            TagSet: [
                { Key: 'provisioned-by', Value: 'mini-broker' },
                { Key: 'created-at', Value: new Date().toISOString() }
            ]
        }
    }))

    // Return useful metadata
    const location = await client.send(
        new GetBucketLocationCommand({ Bucket: bucketName })
    )

    return {
        bucketName,
        region: location.LocationConstraint ?? 'us-east-1',
        arn: `arn:aws:s3:::${bucketName}`,
        versioning
    }
}

async function emptyVersionedBucket(client, bucketName) {
    const { DeleteMarkerEntries, Versions } = await client.send(
        new ListObjectVersionsCommand({ Bucket: bucketName })
    )

    const objects = [
        ...(Versions ?? []),
        ...(DeleteMarkerEntries ?? [])
    ].map(v => ({ Key: v.Key, VersionId: v.VersionId }))

    if (objects.length === 0) return

    await client.send(new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: objects }
    }))
}

async function emptyBucket(client, bucketName) {
    while (true) {
        const list = await client.send(new ListObjectsV2Command({
            Bucket: bucketName
        }))

        if (!list.Contents || list.Contents.length === 0) break

        // delete up to 1000 objects at a time (S3 limit)
        await client.send(new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
                Objects: list.Contents.map(obj => ({ Key: obj.Key }))
            }
        }))

        // if truncated, there are more objects — loop again
        if (!list.IsTruncated) break
    }
}

export async function deleteBucket({ bucketName, region }) {
    const globalClient = new S3Client({ region: 'us-east-1' })

    const location = await globalClient.send(
        new GetBucketLocationCommand({ Bucket: bucketName })
    )

    const currentRegion = location.LocationConstraint ?? 'us-east-1'
    const client = new S3Client({ region: currentRegion })

    // S3 won't delete a bucket that still has objects
    // so we empty it first
    await emptyBucket(client, bucketName)
    await emptyVersionedBucket(client, bucketName)  // in case versioning was enabled

    await client.send(new DeleteBucketCommand({ Bucket: bucketName }))

    console.log(`[s3] deleted bucket → ${bucketName}`)
    return { bucketName, deleted: true }
}
