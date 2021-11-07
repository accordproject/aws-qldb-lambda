/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *   
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const AWS = require('aws-sdk');
const fs = require('fs');
const Util = require('util');
const logger = require("./logging").getLogger("s3-kvs");

module.exports = class SQSClient {
    constructor(queueName, regionName) {
        let self = this;
        if (!queueName) {
            throw new Error(`${fcnName}: Please specify queueName`);
        }
        if (!regionName) {
            throw new Error(`${fcnName}: Please specify regionName`);
        }
        self.__sqs = new AWS.SQS({
            apiVersion: '2012-11-05',
            region: regionName
        });

        self.queueName = queueName;
        return self;

    }

    // Send event to SQS queue
    sendEvent(event) {
        const fcnName = "[SQSClient.sendEvent]";
        const self = this;
        const queueName = self.queueName;
        const sqs = self.__sqs;

        if (!event) {
            throw new Error(`${fcnName}: Please specify event`);
        }

        logger.debug(`${fcnName} Sending to the queue with name ${queueName} the following event: ${JSON.stringify(event)}`);

        return new Promise(async (resolve, reject) => {
            try {
                let params = {
                    DelaySeconds: 10,
                    MessageBody: JSON.stringify(event),
                    QueueUrl: queueName
                };
                const result = await sqs.sendMessage(params).promise();
                resolve(result);
            } catch (err) {
                //throw `${fcnName}: ${err}`;
                logger.info(`${fcnName} Could not send event message: ${err}`);
                resolve(null)
            }
        });
    };
}