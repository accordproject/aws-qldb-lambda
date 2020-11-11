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

export SAM_S3_TEMPLATE_PATH="./accord-sam-s3-template.yaml"

if test -f "./devops/accord-sam-s3-template.yaml"; then
    export SAM_S3_TEMPLATE_PATH="./devops/accord-sam-s3-template.yaml"
fi

echo " "
echo "Deploying deploying S3 bucket for SAM application deployment."
echo "ACCORD_REGION="$ACCORD_REGION
echo "ACCORD_DEPLOY_SAM_S3_BUCKET="$ACCORD_DEPLOY_SAM_S3_BUCKET
echo "ACCORD_BUILD_BUCKET_NAME_PREFIX="$ACCORD_BUILD_BUCKET_NAME_PREFIX
echo "ACCORD_STACK_NAME="$ACCORD_STACK_NAME

export ACCORD_SAM_S3_STACK_NAME="$ACCORD_STACK_NAME-s3";
echo "ACCORD_SAM_S3_STACK_NAME="$ACCORD_SAM_S3_STACK_NAME

export ACCORD_SAM_BUILD_BUCKET_ARN_KMS_KEY=

if [ "$ACCORD_DEPLOY_SAM_S3_BUCKET" = true ] ; then
    
    aws cloudformation deploy --region $ACCORD_REGION --template-file $SAM_S3_TEMPLATE_PATH --stack-name $ACCORD_SAM_S3_STACK_NAME \
    --parameter-overrides SAMBucketName=$ACCORD_BUILD_BUCKET_NAME_PREFIX \
    --no-fail-on-empty-changeset

fi

export ACCORD_SAM_BUILD_BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name $ACCORD_SAM_S3_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`SAMArtifactStoreBucketName`].OutputValue' --output text)
echo "ACCORD_SAM_BUILD_BUCKET_NAME="$ACCORD_SAM_BUILD_BUCKET_NAME

export ACCORD_SAM_BUILD_BUCKET_ARN=$(aws cloudformation describe-stacks --stack-name $ACCORD_SAM_S3_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`SAMArtifactStoreBucketARN`].OutputValue' --output text)
echo "ACCORD_SAM_BUILD_BUCKET_ARN="$ACCORD_SAM_BUILD_BUCKET_ARN

export ACCORD_SAM_BUILD_BUCKET_ARN_KMS_KEY=$(aws cloudformation describe-stacks --stack-name $ACCORD_SAM_S3_STACK_NAME --region $ACCORD_REGION --query 'Stacks[0].Outputs[?OutputKey==`SAMArtifactStoreBucketKMSKeyARN`].OutputValue' --output text)
echo "ACCORD_SAM_BUILD_BUCKET_ARN_KMS_KEY="$ACCORD_SAM_BUILD_BUCKET_ARN_KMS_KEY