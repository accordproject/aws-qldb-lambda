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

const logger = require("/opt/nodejs/lib/logging").getLogger("fcn-qldb-get-document-revision");
const Config = require("./config");
const QLDBHelper = require("amazon-qldb-kvs-nodejs").QLDBHelper;

/**
 * Verifies metadata information, sent to the function
 * <ol>
 *   <li>event.documentKey A value of the document's key parameter.
 *   <li>event.ledgerMetadata An object, holding a ledger metadata for document verification. Includes th following parameters:
 *   <li>event.ledgerMetadata.LedgerName
 *   <li>event.ledgerMetadata.TableName
 *   <li>event.ledgerMetadata.BlockAddress
 *   <li>event.ledgerMetadata.DocumentId
 *   <li>event.ledgerMetadata.RevisionHash
 *   <li>event.ledgerMetadata.Proof
 *   <li>event.ledgerMetadata.LedgerDigest
 * </ol>
 */

exports.handler = async (event, context) => {

    const fcnName = "[fcn-qldb-get-document-revision]";
    return new Promise(async (resolve, reject) => {
        try {

            logger.info(`${fcnName}============= START : Retrieving Document Revision ===========`);

            config = await new Config(event);

            logger.info(`${fcnName} New config object: ${JSON.stringify(config)}`);

            const ledgerName = config.ledgerName;
            const tableName = config.tableName;
            const documentId = config.documentId;
            const blockAddress = config.blockAddress;

            const qldbHelper = new QLDBHelper(ledgerName);

            // get verification result
            const result = await qldbHelper.getDocumentVersionByIdAndBlock(tableName, documentId, blockAddress);

            const output = {
                response: result
            }
            resolve(JSON.stringify(output));
        } catch (err) {
            logger.error(`${fcnName}: ${err}`);
            logger.debug(`${err.stack}`);
            const output = {
                error: `${fcnName}: ${err}`
            }
            reject(JSON.stringify(output));
        }
    })
};