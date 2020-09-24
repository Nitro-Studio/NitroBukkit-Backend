'use strict'

const fs = require('fs');

exports.checkDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    return dir;
}