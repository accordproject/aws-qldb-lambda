/*
# Copyright 2019 Nikolay Vlasov
# 
# Licensed under the Apache License, Version 2.0 (the "License").
# You may not use this file except in compliance with the License.
# A copy of the License is located at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# or in the "license" file accompanying this file. This file is distributed 
# on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either 
# express or implied. See the License for the specific language governing 
# permissions and limitations under the License.
#
*/

const AWS = require('aws-sdk');
const fs = require('fs');
const Util = require('util');
const logger = require("./logging").getLogger("s3-kvs");

const DEFAULT_DOWNLOADS_PATH = "/tmp/downloads";
const mkdir = Util.promisify(fs.mkdir);

module.exports = class S3KVS {
    constructor(bucketName, prefix, withSSE) {
        let self = this;

        self.__s3 = new AWS.S3();
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
        const self = this;
        const bucketName = self.bucketName;
        const paramId = self.prefix === "" ? key : `${self.prefix}/${key}`;
        const s3 = self.__s3;
        if (!key) {
            throw new Error(`${fcnName}: Please specify key`);
        }

        logger.debug(`${fcnName} Getting value of ${bucketName}/${paramId} into a JSON object. (Expecting utf8 encoded string)`);
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
                resolve(JSON.parse(data.Body.toString('utf-8')));
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

        let valueAsString = value;

        if (typeof value !== "string") {
            try {
                valueAsString = JSON.stringify(value);
            } catch (err) {
                throw new Error(`${fcnName} Could not parse submitted value [${value}] to JSON: ${err}`);
            }
        }

        const valueAsBuffer = Buffer.from(valueAsString);

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