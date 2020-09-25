'use strict'

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const checkDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    return dir;
}

const generateChecksum = (str, algorithm, encoding) => {
    return crypto
        .createHash(algorithm || 'md5')
        .update(str, 'utf8')
        .digest(encoding || 'hex');
}


const buildDir = checkDir(path.join(process.cwd(), 'build'));
const jarsDir = checkDir(path.join(buildDir, 'jars'));

exports.checkDir = checkDir;

exports.generateChecksum = generateChecksum;

exports.updateJarList = (filePath, name, ver) => {
    const sum = this.checkSum(filePath);

    if(!fs.existsSync(`${jarsDir}/list.json`)) {
        fs.writeFile(`${jarsDir}/list.json`, '[]');
    }
    json = JSON.parse(fs.readFile(`${jarsDir}/list.json`));
    //if(json)
}

exports.checkSum = (filePath) => {
    fs.readFile(filePath, function(err, data) {
        var checksum = generateChecksum(data);
        console.log(checksum);
        return checksum;
    });
}
