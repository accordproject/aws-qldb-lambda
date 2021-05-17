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

const logger = require("/opt/nodejs/lib/logging").getLogger("config");

module.exports = class Config {
    constructor(event) {
        const fcnName = "[Config.constructor]";

        return new Promise(async (resolve, reject) => {
            try {

                this.ledgerName = event.ledgerName ? event.ledgerName : process.env.ACCORD_LEDGER_NAME
                if (!this.ledgerName || !this.ledgerName instanceof String || !this.ledgerName.length) {
                    throw new Error(` Please specify ledgerName in the event message or set ACCORD_LEDGER_NAME environmental variable`)
                };

                this.contractId = event.contractId
                if (!this.contractId || !this.contractId instanceof String || !this.contractId.length) {
                    throw new Error(` Please specify contractId in the event message`)
                };

                this.contractSourceS3BucketName = event.contractSourceS3BucketName ? event.contractSourceS3BucketName : process.env.ACCORD_S3_CONTRACTS_REPO_NAME
                if (!this.contractSourceS3BucketName || !this.contractSourceS3BucketName instanceof String || !this.contractSourceS3BucketName.length) {
                    throw new Error(` Please specify contractSourceS3BucketName in the event message or set ACCORD_S3_CONTRACTS_REPO_NAME environmental variable`)
                };

                this.ledgerDataPath = event.ledgerDataPath ? event.ledgerDataPath : this.contractId;
                this.eventsQueueURL = event.eventsQueueURL ? event.eventsQueueURL : process.env.ACCORD_EVENTS_QUEUE_URL;

                this.contractFileName = `${this.contractId}.cta`
                this.contractDataKeyName = `${this.contractId}.data`
                this.contractStateKeyName = `${this.contractId}.state`
                this.contractResultKeyName = `${this.contractId}.result`

                this.requestString = event.requestString
                if (!this.requestString || !this.requestString instanceof String || !this.requestString.length) {
                    throw new Error(` Please specify requestString in the event message`)
                };

                resolve(this);

            } catch (err) {
                reject(`${fcnName}: ${err}`);
                throw Error(`${fcnName}: ${err}`);
            }
        })
    }
}