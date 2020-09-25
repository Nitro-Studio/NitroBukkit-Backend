'use strict'

const Deque = require("collections/deque");

const downloadDeque = new Deque();
let isRunning = false;

const download = async () => {
    const task = downloadDeque.shift();
    await task.run(task.config).then(() => {
        task.action(true);
    }).catch((error) => {
        console.error(error);
        task.action(false);
    });
    if (downloadDeque.length > 0) {
        download();
    } else {
        isRunning = false;
    }
}

exports.newDownload = (run, config, action) => {
    if (!isRunning) {
        isRunning = true;
        downloadDeque.push({
            run: run,
            config: config,
            action: action
        });
        download();
    } else {
        downloadDeque.push({
            run: run,
            config: config,
            action: action
        });
    }
}