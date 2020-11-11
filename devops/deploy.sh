#!/bin/bash

# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#   
# Licensed under the Apache License, Version 2.0 (the "License").
# You may not use this file except in compliance with the License.
# You may obtain a copy of the License at

# http://www.apache.org/licenses/LICENSE-2.0

# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

export ACCORD_REGION="us-east-1"
export ACCORD_STACK_NAME="accord-contracts"

export ACCORD_DEPLOY_SAM_S3_BUCKET=true
export ACCORD_BUILD_BUCKET_NAME_PREFIX="accord-sam"

export ACCORD_S3_CONTRACTS_REPO_NAME="accord-contracts"
export ACCORD_QLDB_LEDGER_NAME="accord-contracts"

export ACCORD_EVENTS_SQS_QUEUE_NAME="accord-contracts-output"

echo "Creating deployment and execution environment for Accord Project contracts:"
echo "ACCORD_REGION="$ACCORD_REGION
echo "ACCORD_STACK_NAME="$ACCORD_STACK_NAME

echo "ACCORD_DEPLOY_SAM_S3_BUCKET="$ACCORD_DEPLOY_SAM_S3_BUCKET
echo "ACCORD_BUILD_BUCKET_NAME_PREFIX="$ACCORD_BUILD_BUCKET_NAME_PREFIX

echo "ACCORD_S3_CONTRACTS_REPO_NAME="$ACCORD_S3_CONTRACTS_REPO_NAME
echo "ACCORD_QLDB_LEDGER_NAME="$ACCORD_QLDB_LEDGER_NAME
#echo "ACCORD_S3_LEDGER_NAME="$ACCORD_S3_LEDGER_NAME

echo "ACCORD_EVENTS_SQS_QUEUE_NAME="$ACCORD_EVENTS_SQS_QUEUE_NAME

if test -f "./devops/deploy-accord-sam-s3-bucket.sh"; then
    source ./devops/deploy-accord-sam-s3-bucket.sh
fi

if test -f "./deploy-accord-sam-s3-bucket.sh"; then
    source ./deploy-accord-sam-s3-bucket.sh
fi

echo "ACCORD_SAM_BUILD_BUCKET_NAME="$ACCORD_SAM_BUILD_BUCKET_NAME
echo "ACCORD_SAM_S3_STACK_NAME="$ACCORD_SAM_S3_STACK_NAME
echo "ACCORD_SAM_BUILD_BUCKET_ARN_KMS_KEY="$ACCORD_SAM_BUILD_BUCKET_ARN_KMS_KEY

sam package --template-file ./accord-sam-template.yaml --s3-bucket $ACCORD_SAM_BUILD_BUCKET_NAME > ./template-orig.yaml --kms-key-id $ACCORD_SAM_BUILD_BUCKET_ARN_KMS_KEY
cat ./template-orig.yaml | sed 's/Uploading.*//' > ./template.yaml
rm ./template-orig.yaml

aws cloudformation deploy --region $ACCORD_REGION --template-file ./template.yaml --stack-name $ACCORD_STACK_NAME \
--parameter-overrides \
ContractTemplatesRepositoryS3BucketName=$ACCORD_S3_CONTRACTS_REPO_NAME \
QLDBContractLedgerName=$ACCORD_QLDB_LEDGER_NAME \
EventsQueueName=$ACCORD_EVENTS_SQS_QUEUE_NAME \
--capabilities CAPABILITY_NAMED_IAM --no-fail-on-empty-changeset

export ACCORD_DEPLOY_LAMBDA_ARN=$(aws cloudformation describe-stacks --stack-name $ACCORD_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`AccordDeployARN`].OutputValue' --output text)
echo "ACCORD_DEPLOY_LAMBDA_ARN="$ACCORD_DEPLOY_LAMBDA_ARN

export ACCORD_EXECUTE_LAMBDA_ARN=$(aws cloudformation describe-stacks --stack-name $ACCORD_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`AccordExecuteARN`].OutputValue' --output text)
echo "ACCORD_EXECUTE_LAMBDA_ARN="$ACCORD_EXECUTE_LAMBDA_ARN

export QLDB_GET_REVISION_LAMBDA_ARN=$(aws cloudformation describe-stacks --stack-name $ACCORD_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`QLDBGetDocRevisionARN`].OutputValue' --output text)
echo "QLDB_GET_REVISION_LAMBDA_ARN="$QLDB_GET_REVISION_LAMBDA_ARN

export QLDB_VERIFY_LAMBDA_ARN=$(aws cloudformation describe-stacks --stack-name $ACCORD_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`QLDBVerifyARN`].OutputValue' --output text)
echo "QLDB_VERIFY_LAMBDA_ARN="$QLDB_VERIFY_LAMBDA_ARN

export ACCORD_CONTRACT_LEDGER_NAME=$(aws cloudformation describe-stacks --stack-name $ACCORD_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`ContractLedgerName`].OutputValue' --output text)
echo "ACCORD_CONTRACT_LEDGER_NAME="$ACCORD_CONTRACT_LEDGER_NAME

export ACCORD_EVENTS_SQS_QUEUE_ARN=$(aws cloudformation describe-stacks --stack-name $ACCORD_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`EventsQueueARN`].OutputValue' --output text)
echo "ACCORD_EVENTS_SQS_QUEUE_ARN="$ACCORD_EVENTS_SQS_QUEUE_ARN