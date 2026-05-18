# Mini Broker

Self-service AWS infrastructure provisioning via REST API.
Inspired by Atlassian's internal Open Service Broker talk.

## Architecture
![DLQ Flow](./docs/dlq.png)

## Running locally
npm run api      # terminal 1
npm run worker   # terminal 2

### With Docker
docker compose up --build


## Supported resources
| Resource | Operations |
|----------|-----------|
| S3 | create, delete |
| EC2 | launch, stop, terminate |

## Stack
Node.js · Express · AWS SQS · DynamoDB · EC2 · S3

## How it works
1. POST a provisioning request → API returns 202 immediately
2. Worker picks up the job from SQS asynchronously
3. Poll /last_operation for PENDING → IN_PROGRESS → COMPLETE