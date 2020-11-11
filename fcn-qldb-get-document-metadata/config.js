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

                this.tableName = event.tableName;
                if (!this.tableName || !this.tableName.length) {
                    throw new Error(` Please specify tableName in the event message`)
                };

                this.documentKey = event.documentKey;

                if (!this.documentKey || !this.documentKey.length) {
                    throw new Error(` Please specify documentKey in the event message`)
                };

                resolve(this);

            } catch (err) {
                reject(`${fcnName}: ${err}`);
                throw Error(`${fcnName}: ${err}`);
            }
        })
    }
}