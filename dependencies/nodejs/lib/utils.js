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

const Unzipper = require('unzipper');
const fs = require('fs-extra');
const Util = require('util');
const logger = require("./logging").getLogger("utils");

const ensureDir = Util.promisify(fs.ensureDir);
const emptyDir = Util.promisify(fs.emptyDir);

const __objectIterator = async (object, func) => {
    const promises = Object.keys(object).map(async (key) => {
        await func(key, object[key])
    });
    return await Promise.all(promises);
}

const __arrayIterator = async (array, func) => {
    const promises = array.map(async (arrayMember) => {
        await func(arrayMember)
    });
    return await Promise.all(promises);
}

const __stringifyCircularJSON = (jsonObj) => {
    var cache = [];
    const response = JSON.stringify(jsonObj, function (key, value) {
        if (typeof value === 'object' && value !== null) {
            if (cache.indexOf(value) !== -1) {
                // Duplicate reference found, discard key
                return;
            }
            // Store value in our collection
            cache.push(value);
        }
        return value;
    });
    return response;
}

const __timeout = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const __formatResponseSuccess = (result, id) => {
    const fcnName = "[__formatResponse]"

    if (!result || !result instanceof String || !result.length) {
        throw new Error(`${fcnName} Please specify "result" parameter in the function call`)
    };

    if (!id || !id instanceof String || !id.length) {
        throw new Error(`${fcnName} Please specify "id" parameter in the function call`)
    };

    return {
        jsonrpc: "2.0",
        result: result,
        id: id
    }
}

const __formatResponseError = (message, id, code) => {
    const fcnName = "[__formatResponse]"

    const errorCode = code ? code : -32603;

    if (!message || !message instanceof String || !message.length) {
        throw new Error(`${fcnName} Please specify "message" parameter in the function call`)
    };

    if (!id || !id instanceof String || !id.length) {
        throw new Error(`${fcnName} Please specify "id" parameter in the function call`)
    };

    return {
        jsonrpc: "2.0",
        error: {
            code: errorCode,
            message: message
        },
        id: id
    }
}

const __genRandomString = (length) => {
    const fcnName = "[__genRandomString]"

    const pwdChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    const pwdLen = length ? length : 12;
    const randPassword = Array(pwdLen).fill(pwdChars).map(function (x) {
        return x[Math.floor(Math.random() * x.length)]
    }).join('');

    return randPassword;
}

const __unzip = (sourceFilePath, targetPath) => {
    const fcnName = "[__unzip]"

    return new Promise(async (resolve, reject) => {
        try {
            // Unzipper.Open.file(sourceFilePath)
            //     .then(async (directory) => {
            //         await directory.extract({
            //             path: targetPath,
            //             concurrency: 1
            //         })
            //         resolve(targetPath)
            //     });
            fs.createReadStream(sourceFilePath)
                .pipe(Unzipper.Parse())
                .on('entry', async (entry) => {
                    const fullPath = `${targetPath}/${entry.path}`;
                    const type = entry.type; // 'Directory' or 'File'
                    if (type === 'File') {
                        let pathElementsArray = fullPath.split("/");
                        pathElementsArray.splice(-1, 1);
                        const dirPath = pathElementsArray.join("/");
                        //logger.debug(`${fcnName} Checking dir: ${dirPath}`);
                        await ensureDir(`${dirPath}`);

                        //logger.debug(`${fcnName} Uzipping file: ${fullPath}`);
                        entry.pipe(fs.createWriteStream(`${fullPath}`));
                    }
                    entry.autodrain();
                })
                .on('error', async (err) => {
                    logger.error(`${fcnName} Error: ${err}. Emptying dir: ${targetPath}`);
                    await emptyDir(targetPath);
                    throw `${fcnName} ${err}`
                })
                .on('finish', () => {
                    resolve(targetPath)
                });
        } catch (err) {
            throw `${fcnName} ${err}`
        }
    })
}

module.exports.__objectIterator = __objectIterator;
module.exports.__arrayIterator = __arrayIterator;
module.exports.__stringifyCircularJSON = __stringifyCircularJSON;
module.exports.__timeout = __timeout;
module.exports.__formatResponseSuccess = __formatResponseSuccess;
module.exports.__genRandomString = __genRandomString;
module.exports.__unzip = __unzip;