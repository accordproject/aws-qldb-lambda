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

const logger = require("/opt/nodejs/lib/logging").getLogger("fcn-qldb-get-document-history");
const Config = require("./config");
const QLDBKVS = require("amazon-qldb-kvs-nodejs").QLDBKVS;

/**
 * Retrieves document metadata by ID assigned by the ledger or by Key
 * <ol>
 *   <li>event.ledgerName (optional)
 *   <li>event.tableName
 *   <li>event.documentKey A value of the document key parameter.
 * </ol>
 */

exports.handler = async (event, context) => {

    const fcnName = "[fcn-qldb-get-document-history]";
    return new Promise(async (resolve, reject) => {
        try {

            logger.info(`${fcnName}============= START : Retrieving Document History ===========`);

            config = await new Config(event);

            logger.info(`${fcnName} New config object: ${JSON.stringify(config)}`);

            const ledgerName = config.ledgerName;
            const tableName = config.tableName;
            const documentKey = config.documentKey;

            const qldbKVS = new QLDBKVS(ledgerName, tableName);

            // get verification result
            const result = await qldbKVS.getHistory(documentKey);

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