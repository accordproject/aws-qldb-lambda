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

const DEFAULT_DOWNLOADS_PATH = "/tmp/downloads";
const mkdir = Util.promisify(fs.mkdir);

module.exports = class S3KVS {
    constructor(bucketName, prefix, withSSE) {
        const fcnName = "[S3KVS.constructor]";
        let self = this;

        self.__s3 = new AWS.S3({ httpOptions: { timeout: 3000 } });
        if (!bucketName) {
            throw new Error(`${fcnName}: Please specify bucketName`);
        }
        self.bucketName = bucketName;
        self.prefix = prefix ? prefix : "";
        self.withSSE = withSSE ? withSSE : false;

        return self;

    }

    // Download from s3 as a file
    downloadAsFile(key, localFilePath) {
        const fcnName = "[S3KVS.downloadAsFile]";
        const self = this;
        const bucketName = self.bucketName;
        const paramId = self.prefix === "" ? key : `${self.prefix}/${key}`;
        const filePath = localFilePath ? localFilePath : DEFAULT_DOWNLOADS_PATH + key;
        const s3 = self.__s3;

        if (!key) {
            throw new Error(`${fcnName}: Please specify key`);
        }
        if (!localFilePath) {
            throw new Error(`${fcnName}: Please specify localFilePath`);
        }

        logger.debug(`${fcnName} Downloading ${bucketName}/${paramId} to ${filePath}`);

        return new Promise(async (resolve, reject) => {
            try {
                let params = {
                    Bucket: bucketName,
                    Key: paramId
                }
                await s3.headObject(params).promise();
                logger.debug(`${fcnName} Requested object exists.`);

                if (!localFilePath) {
                    if (!fs.existsSync(DEFAULT_DOWNLOADS_PATH)) {
                        await mkdir(DEFAULT_DOWNLOADS_PATH);
                    }
                }

                const file = fs.createWriteStream(filePath);

                s3.getObject(params).on('error', (err) => {
                    file.destroy();
                    //reject(`${fcnName}: Error downloading file ${filePath} from S3: ${err}`);
                    resolve(null)
                    throw new Error(`${fcnName}: Error downloading file ${filePath} from ${paramId} in S3: ${err}`);
                })
                    .on('httpData', (chunk) => {
                        file.write(chunk, (err) => {
                            if (err) {
                                //reject(`${fcnName}: Error writing file: ${err}`);
                                throw new Error(`${fcnName}: Error writing file: ${err}`);
                            }
                        });
                    })
                    .on('httpDone', () => {
                        file.end();
                        logger.log(`${fcnName} Finished downloading file to ${filePath}`);
                        resolve(filePath);
                    })
                    .send();
            } catch (err) {
                //throw `${fcnName}: ${err}`;
                logger.info(`${fcnName} Requested object does not exist.`);
                resolve(null)
            }
        });
    };

    // Get object from s3 as a JSON
    getValue(key) {
        const fcnName = "[S3KVS.getValue]";
        return new Promise(async (resolve, reject) => {
            const valueAsString = await this.getStringValue(key);
            if (valueAsString !== null) {
                resolve(JSON.parse(valueAsString));
            } else {
                resolve(null);
            }
        })

    };

    getStringValue(key) {
        const fcnName = "[S3KVS.getStringValue]";
        return new Promise(async (resolve, reject) => {
            const valueAsBuffer = await this.getBufferValue(key);
            if (valueAsBuffer !== null) {
                resolve(valueAsBuffer.toString('utf-8'));
            } else {
                resolve(null);
            }
        })
    };

    getBufferValue(key) {
        const fcnName = "[S3KVS.getBufferValue]";
        const self = this;
        const bucketName = self.bucketName;
        const paramId = self.prefix === "" ? key : `${self.prefix}/${key}`;
        const s3 = self.__s3;
        if (!key) {
            throw new Error(`${fcnName}: Please specify key`);
        }

        logger.debug(`${fcnName} Getting value of ${bucketName}/${paramId} into a Buffer object`);
        return new Promise(async (resolve, reject) => {
            let params = {
                Bucket: bucketName,
                Key: paramId
            }
            try {
                await s3.headObject(params).promise();
                logger.debug(`${fcnName} Requested object exists.`);
                const data = await s3.getObject(params).promise();
                if (!data) {
                    resolve(null);
                }
                resolve(data.Body);
            } catch (err) {
                logger.info(`${fcnName} Requested object does not exist.`);
                resolve(null)
            }
        });
    };

    //Put a JSON object to s3 key
    setValue(key, value) {
        const fcnName = "[S3KVS.setValue]";
        const self = this;
        const bucketName = self.bucketName;
        const paramId = self.prefix === "" ? key : `${self.prefix}/${key}`;
        const s3 = self.__s3;
        const withSSE = this.withSSE;

        if (!key) {
            throw new Error(`${fcnName}: Please specify key`);
        }
        if (!value) {
            throw new Error(`${fcnName}: Please specify value`);
        }

        let valueAsBuffer;

        if (typeof value === "string") {
            valueAsBuffer = Buffer.from(value);
        } else if (Buffer.isBuffer(value)) {
            valueAsBuffer = value
        } else {
            // If value is not a string or a Buffer, we assume it is a JSON object
            try {
                const valueAsString = JSON.stringify(value);
                valueAsBuffer = Buffer.from(valueAsString);
            } catch (err) {
                throw new Error(`${fcnName} Could not parse submitted value [${value}] to JSON: ${err}`);
            }
        }

        logger.debug(`${fcnName} Setting value of ${bucketName}/${paramId} as utf8 encoded stringified JSON object.`);

        let params = {
            ACL: "bucket-owner-full-control",
            Bucket: bucketName,
            Key: paramId,
            Body: valueAsBuffer
        }

        if (withSSE) {
            params.ServerSideEncryption = "aws:kms";
        }
        return s3.putObject(params).promise();
    };

    //Upload a file to s3 key
    uploadAsFile(key, filePath) {
        const fcnName = "[S3.uploadAsFile]";
        const self = this;
        const bucketName = self.bucketName;
        const paramId = self.prefix === "" ? key : `${self.prefix}/${key}`;
        const s3 = self.__s3;
        const withSSE = this.withSSE;

        if (!key) {
            throw new Error(`${fcnName}: Please specify key`);
        }
        if (!filePath) {
            throw new Error(`${fcnName}: Please specify filePath`);
        }

        logger.debug(`${fcnName} Start uploading file ${filePath} to ${bucketName}/${paramId}`);

        let params = {
            //ACL: "authenticated-read",
            Bucket: bucketName,
            Key: paramId,
            Body: fs.createReadStream(filePath, (err) => {
                if (err) {
                    throw new Error(`${fcnName}: Error reading the file ${localFilePath}: ${err}`);
                }
            })
        }

        if (withSSE) {
            params.ServerSideEncryption = "aws:kms";
        }

        return s3.putObject(params).promise();
    };
}