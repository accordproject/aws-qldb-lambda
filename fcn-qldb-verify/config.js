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

                this.ledgerMetadata = event.ledgerMetadata;

                if (!this.ledgerMetadata) {
                    throw new Error(` Please specify ledgerMetadata in the event message`)
                };
                if (!this.ledgerMetadata.LedgerName || !this.ledgerMetadata.LedgerName.length) {
                    throw new Error(` Please specify ledgerMetadata.LedgerName in the event message`)
                };
                if (!this.ledgerMetadata.TableName || !this.ledgerMetadata.TableName.length) {
                    throw new Error(` Please specify ledgerMetadata.TableName in the event message`)
                };
                if (!this.ledgerMetadata.BlockAddress) {
                    throw new Error(` Please specify ledgerMetadata.BlockAddress in the event message`)
                };
                if (!this.ledgerMetadata.DocumentId || !this.ledgerMetadata.DocumentId.length) {
                    throw new Error(` Please specify ledgerMetadata.DocumentId in the event message`)
                };
                if (!this.ledgerMetadata.RevisionHash || !this.ledgerMetadata.RevisionHash.length) {
                    throw new Error(` Please specify ledgerMetadata.RevisionHash in the event message`)
                };
                if (!this.ledgerMetadata.Proof) {
                    throw new Error(` Please specify ledgerMetadata.Proof in the event message`)
                };
                if (!this.ledgerMetadata.LedgerDigest) {
                    throw new Error(` Please specify ledgerMetadata.LedgerDigest in the event message`)
                };

                resolve(this);

            } catch (err) {
                reject(`${fcnName}: ${err}`);
                throw Error(`${fcnName}: ${err}`);
            }
        })
    }
}