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

const logger = require("/opt/nodejs/lib/logging").getLogger("fcn-cicero-execute");
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
const {
    join
} = require("path");

const QLDBKVS = require("amazon-qldb-kvs-nodejs").QLDBKVS;
const CONTRACT_TEMPLATE_REPO_KVS_LIB_PATH = process.env.CONTRACT_TEMPLATE_REPO_KVS_LIB_PATH ? process.env.CONTRACT_TEMPLATE_REPO_KVS_LIB_PATH : "/opt/nodejs/lib/s3-kvs.js";
const S3 = require(CONTRACT_TEMPLATE_REPO_KVS_LIB_PATH);

const emptyDir = Util.promisify(fs.emptyDir);
const mkdir = Util.promisify(fs.mkdir);

const STORAGE_DIR = "/tmp";
const TARGET_DIR = `${STORAGE_DIR}/downloads`;
const AWS_REGION_NAME = process.env.AWS_REGION_NAME;

/**
 * Executes a previously Smart Legal Contract, stored in the S3 bucket.
 * <ol>
 *   <li>event.s3BucketName (string), the name of an S3 bucket, where Smart Legal Contract is stored.
 *   <li>event.contractId (string), the identifier of the contract. Used on subsequent
 *       calls to `executeSmartLegalContract`.
 *   <li>event.requestText (JSON string), the JSON object (as a string) for request object
 *       for the contract. Must be a valid instance of a contract request type.
 * </ol>
 */

exports.handler = async (event, context) => {

    const fcnName = "[fcn-cicero-execute]";
    return new Promise(async (resolve, reject) => {
        try {

            logger.info(`${fcnName}============= START : Execute Smart Contract ===========`);

            let config = await new Config(event);
            const ledgerName = config.ledgerName;
            const contractId = config.contractId;
            const ledgerDataPath = config.ledgerDataPath;
            const contractFileName = config.contractFileName;
            const eventsQueueURL = config.eventsQueueURL;
            const contractSourceS3BucketName = config.contractSourceS3BucketName;

            const requestString = config.requestString;

            const contractDataKeyName = config.contractDataKeyName;
            const contractStateKeyName = config.contractStateKeyName;
            const contractResultKeyName = config.contractResultKeyName;

            logger.info(`${fcnName} New config object: ${JSON.stringify(config)}`);

            const s3 = new S3(contractSourceS3BucketName, "", false, TARGET_DIR);
            const qldbKVS = new QLDBKVS(ledgerName, ledgerDataPath, false);

            await emptyDir(STORAGE_DIR);
            await mkdir(TARGET_DIR);

            const contractFilePath = `${TARGET_DIR}/${contractFileName}`;

            const contractTemplateLinkObject = await qldbKVS.getValue(contractFileName);

            const templateData = await s3.downloadAsFile(contractTemplateLinkObject.s3path, contractFilePath);

            logger.debug(`${fcnName} Received template data: ${templateData}`);

            if (!templateData) {
                throw new Error(`Did not find an active contract file ${contractFileName}. Please ensure it has been uploaded to the ledger with id '${ledgerName}' and ledger data path '${ledgerDataPath}'.`);
            }
            // const templateDataString = Buffer.from(templateDataArray).toString();
            // logger.info(`${fcnName} Loaded template data: ${templateDataString}`);
            // check that the template is valid
            const contractUnzipFolder = `${TARGET_DIR}/contract`;
            await Utils.__unzip(contractFilePath, contractUnzipFolder)
            const template = await Template.fromDirectory(contractUnzipFolder); //Buffer.from(templateDataString, 'base64'));
            logger.info(`${fcnName} Loaded template: ${template.getIdentifier()}`);

            if (template.getHash() !== contractTemplateLinkObject.hash) {
                throw new Error(`Got unexpected hash of the template retrieved from S3. Expected: ${contractTemplateLinkObject.hash} received: ${template.getHash()}`);
            }

            // load data
            let dataJSON;
            try {
                dataJSON = await qldbKVS.getValue(contractDataKeyName);
            } catch (err) {
                throw new Error(`${fcnName} Did not find data for contract ${contractId}. Please ensure it has been deployed.`);
            }

            // load state
            let stateJSON;
            let stateVersion;
            try {
                const state = await qldbKVS.getValue(contractStateKeyName, true);
                stateJSON = state.data;
                stateVersion = state.version;
            } catch (err) {
                throw new Error(`${fcnName} Did not find state for contract ${contractId}. Please ensure it has been deployed.`);
            }

            // parse the request
            let requestJSON = {};
            try {
                requestJSON = JSON.parse(requestString);
            } catch (err) {
                throw new Error(`${fcnName} Couldn't parse request data received: ${requestString}. Error: ${err}`)
            }

            // set the clause data
            const clause = new Clause(template);
            clause.setData(dataJSON);

            // execute the engine
            const engine = new Engine();
            const result = await engine.trigger(clause, requestJSON, stateJSON, null);
            logger.info(`${fcnName} Response from engine execute: ${JSON.stringify(result)}`);

            // save the state
            const stateRes = await qldbKVS.setValue(contractStateKeyName, result.state, stateVersion);

            if (!stateRes) {
                throw new Error(`State for "${contractId}" was not persisted. Please try again later. `)
            }

            // Save the result. Its version should be the same with the state.
            const resultRes = await qldbKVS.setValue(contractResultKeyName, result, stateVersion);

            if (!resultRes) {
                throw new Error(`Result for "${contractId}" was not persisted. Please try again later. `)
            }

            // emit any events
            if (eventsQueueURL) {
                if (result.emit.length > 0) {
                    const sqsClient = new SQSClient(eventsQueueURL, AWS_REGION_NAME);
                    const allPromises = [];
                    let ledgerMetadata = {};
                    if (qldbKVS.getMetadata) {
                        // Giving the ledger some time to settle
                        await Utils.__timeout(400);
                        ledgerMetadata = await qldbKVS.getMetadata(contractResultKeyName);
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