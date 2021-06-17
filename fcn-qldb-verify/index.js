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

const logger = require("/opt/nodejs/lib/logging").getLogger("fcn-qldb-verify");
const Config = require("./config");
const QLDBKVS = require("amazon-qldb-kvs-nodejs").QLDBKVS;

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

    const fcnName = "[fcn-qldb-verify]";
    return new Promise(async (resolve, reject) => {
        try {

            logger.info(`${fcnName}============= START : Verify Ledger Metadata ===========`);

            let config = await new Config(event);

            logger.info(`${fcnName} New config object: ${JSON.stringify(config)}`);

            const ledgerMetadata = config.ledgerMetadata;

            const qldbKVS = new QLDBKVS(ledgerMetadata.LedgerName, ledgerMetadata.TableName, false);

            // get verification result
            const verificationResult = await qldbKVS.verifyLedgerMetadata(ledgerMetadata);

            const output = {
                response: verificationResult
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