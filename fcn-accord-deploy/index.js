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

const logger = require("/opt/nodejs/lib/logging").getLogger("fcn-cicero-deploy");
const Config = require("./config");
const fs = require('fs-extra');
const Util = require('util');
const Utils = require("/opt/nodejs/lib/utils.js");
const SQSClient = require("/opt/nodejs/lib/sqs-client.js");
const {
    Template
} = require('@accordproject/cicero-core');
const {
    Clause
} = require('@accordproject/cicero-core');
const {
    Engine
} = require('@accordproject/cicero-engine');

const CONTRACT_TEMPLATE_REPO_KVS_LIB_PATH = process.env.CONTRACT_TEMPLATE_REPO_KVS_LIB_PATH ? process.env.CONTRACT_TEMPLATE_REPO_KVS_LIB_PATH : "/opt/nodejs/lib/s3-kvs.js";
const KVS = require("amazon-qldb-kvs-nodejs").QLDBKVS;
const S3 = require(CONTRACT_TEMPLATE_REPO_KVS_LIB_PATH);

const emptyDir = Util.promisify(fs.emptyDir);
const mkdir = Util.promisify(fs.mkdir);

const STORAGE_DIR = "/tmp";
const TARGET_DIR = `${STORAGE_DIR}/downloads`;
const AWS_REGION_NAME = process.env.AWS_REGION_NAME;

/**
 * Initializes and deploys a Smart Legal Contract from a template, stored in an S3 bucket.
 * <ol>
 *   <li>event.s3BucketName (string), the name of an S3 bucket, where Smart Legal Contract template is stored.
 *   <li>event.contractId (string), the identifier of the contract. Used on subsequent
 *       calls to `executeSmartLegalContract`.
 *   <li>event.requestText (JSON string), the JSON object (as a string) for request object
 *       for the contract. Must be a valid instance of a contract request type.
 * </ol>
 */

exports.handler = async (event, context) => {

    const fcnName = "[fcn-cicero-deploy]";
    return new Promise(async (resolve, reject) => {
        try {

            logger.info(`${fcnName}============= START : Deploy Smart Contract ===========`);

            config = await new Config(event);
            const ledgerName = config.ledgerName;
            const contractId = config.contractId;
            const ledgerDataPath = config.ledgerDataPath;
            const eventsQueueURL = config.eventsQueueURL;

            const contractSourceS3BucketName = config.contractSourceS3BucketName;
            const contractSourceS3BucketObjectPath = config.contractSourceS3BucketObjectPath;

            const contractDataKeyName = config.contractDataKeyName;
            const contractStateKeyName = config.contractStateKeyName;
            const contractResultKeyName = config.contractResultKeyName;

            const contractFileName = config.contractFileName;
            // const contractDataFileName = config.contractDataFileName;
            // const contractStateFileName = config.contractStateFileName;
            // const contractResultFileName = config.contractResultFileName;

            const contractData = config.contractData;

            logger.info(`${fcnName} New config object: ${JSON.stringify(config)}`);

            // Just to make sure our file system is clean
            await emptyDir(STORAGE_DIR);
            await mkdir(TARGET_DIR);

            const s3 = new S3(contractSourceS3BucketName, "", false, TARGET_DIR);
            const kvs = new KVS(ledgerName, ledgerDataPath);

            // load the template
            const contractFilePath = `${TARGET_DIR}/${contractFileName}`;

            const templateData = await s3.downloadAsFile(contractSourceS3BucketObjectPath, contractFilePath);

            if (!templateData) {
                throw new Error(`Did not find an active contract ${contractId}. Ensure it has been uploaded to S3. (1)`);
            }

            // check that the template is valid
            logger.debug(`${fcnName} Contract source downloaded. Unzipping.`);
            const contractUnzipFolder = `${TARGET_DIR}/contract`;
            await Utils.__unzip(contractFilePath, contractUnzipFolder)
            const template = await Template.fromDirectory(contractUnzipFolder); //Buffer.from(templateDataString, 'base64'));
            logger.info(`${fcnName} Loaded template: ${template.getIdentifier()}`);

            // validate and save the contract data
            const clause = new Clause(template);
            clause.setData(JSON.parse(contractData));

            // save the template data

            logger.info(`${fcnName} Successfully initialized contract "${contractId}" based on "${template.getIdentifier()}"`);

            // Initiate the template
            const engine = new Engine();
            const result = await engine.init(clause);
            logger.debug(`${fcnName} Response from engine init method: ${JSON.stringify(result)}`);

            // Check if contract data exists
            let contractDataExists = true;
            try {
                await kvs.getValue(contractDataKeyName);
            } catch (err) {
                if (err.toString().includes("Requested record does not exist")) {
                    contractDataExists = false;
                } else {
                    throw err;
                }
            }

            //Saving contract data
            if (!contractDataExists) {
                await kvs.setValue(contractDataKeyName, clause.getData());
                logger.debug(`${fcnName} Saved contract data: ${JSON.stringify(clause.getData())}`);
            } else {
                throw new Error(`${fcnName} Ledger with name ${ledgerName} in path ${ledgerDataPath} already has data with id ${contractDataKeyName}. Please clear it up before continuing.`)
            }


            //Checking if contract state exists
            let contractStateExists = true;
            try {
                await kvs.getValue(contractStateKeyName);
            } catch (err) {
                if (err.toString().includes("Requested record does not exist")) {
                    contractStateExists = false;
                } else {
                    throw err;
                }
            }

            if (!contractStateExists) {
                // Saving contract as a file
                await kvs.uploadAsFile(contractFileName, contractFilePath);

                await kvs.setValue(contractStateKeyName, result.state);

                // save full result
                await kvs.setValue(contractResultKeyName, result);
            } else {
                throw new Error(`${fcnName} Ledger with name ${ledgerName} in path ${ledgerDataPath} already has state with id ${contractStateKeyName}. Please clear it up before continuing.`)
            }

            // emit any events
            if (eventsQueueURL) {
                if (result.emit.length > 0) {
                    const sqsClient = new SQSClient(eventsQueueURL, AWS_REGION_NAME);
                    const allPromises = [];
                    let ledgerMetadata = {};
                    if (kvs.getMetadata) {
                        ledgerMetadata = await kvs.getMetadata(contractResultKeyName);
                    }
                    result.emit.forEach(async (event, index) => {
                        const eventMessage = {
                            event: event
                        }
                        if (ledgerMetadata) {
                            eventMessage.ledgerMetadata = ledgerMetadata
                        }
                        allPromises[index] = sqsClient.sendEvent(eventMessage);
                    })
                    await Promise.all(allPromises);
                }
            }
            // return the response
            const output = {
                response: result.response
            }
            resolve(JSON.stringify(output));
        } catch (err) {
            logger.error(`${fcnName}: ${err}`);
            logger.debug(`${err.stack}`);
            const output = {
                error: `${fcnName}: ${err}`
            }
            reject(JSON.stringify(output));
        } finally {
            await emptyDir(STORAGE_DIR);
        }
    })
};