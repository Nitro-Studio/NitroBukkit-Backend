'use strict'

const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const Map = require("collections/map");
const Set = require("collections/set");
const SocketIO = require('socket.io');

const generateChecksum = require('./lib/common').generateChecksum;
const startPaper = require('./lib/minecraft/paper').startPaper;
const startSpigot = require('./lib/minecraft/spigot').startSpigot;
const config = require('./config.json');
const port = config.port;

const app = express();
app.use(express.static(path.join(process.cwd(), "public"), {
    index: config.index
}));

let server;
if (config.ssl) {
    server = https.createServer({
        cert: fs.readFileSync(config.cert),
        key: fs.readFileSync(config.key)
    }, app).listen(port, () => {
        console.log(`Server open at port ${port} (https).`)
    })
} else {
    server = http.createServer(app).listen(port, () => {
        console.log(`Server open at port ${port} (http),`);
    });
}

const hashes = new Set();
const ports = new Set([port]);
const listeners = new Map();
const servers = new Map();
const directories = new Map();

const ws = SocketIO(server, {
    path: '/socket'
})

ws.on('connection', (socket) => {
    socket.on('disconnect', () => {
        listeners.forEach((value) => {
            if (value.has(socket)) {
                value.delete(socket);
            }
        })
    });
    socket.on('create', (data) => {
        const name = data.name;
        const version = data.version;
        const port = data.port;
        const memory = data.memory;
        const type = data.type;
        const checksum = generateChecksum(`${name}${version}${type}`).substring(0, 6);
        if (ports.has(port) || hashes.has(checksum)) {
            socket.emit('err', {
                "reason": "Duplicate configuration"
            });
        } else {
            switch(type) {
                case 'paper':
                    hashes.add(checksum);
                    listeners.set(checksum, new Set([socket]));
                    startPaper(name, version, port, memory, checksum, addServer, listenServer, closedServer, failedServer);
                    break;
                case 'spigot':
                    hashes.add(checksum);
                    listeners.set(checksum, new Set([socket]));
                    startSpigot(name, version, port, memory, checksum, addServer, listenServer, closedServer, failedServer);
                    break;
                default:
                    socket.emit('err', {
                        "reason": `Unknown ${type}`
                    });
                    return;
            }
            socket.emit('init', {
                "hash": checksum
            });
        }
    });
    socket.on('subscribe', (data) => {
        const hash = data.hash;
        if (listeners.has(hash)) {
            listeners.get(hash).add(socket);
        }
    });
    socket.on('unsubscribe', (data) => {
        const hash = data.hash;
        if (listeners.has(hash)) {
            listeners.get(hash).delete(socket);
        }
    });
    socket.on('send', (data) => {
        const hash = data.hash;
        const message = data.message;
        if (servers.has(hash)) {
            servers.get(hash).stdin.write(`${message}\n`);
        }
    });
    socket.on('log', (data) => {
        const hash = data.hash;
        if (directories.has(hash)) {
            fs.readFile(path.join(directories.get(hash), "latest.log"), {
                encoding: 'utf8'
            }, (error, data) => {
                if (error) {
                    socket.emit('err', {
                        "reason": "Unable to open log"
                    })
                } else {
                    data.split(/\r\n|\n/).forEach((str) => {
                        if (str && !/^\s*$/.test(str)) {
                            socket.emit('console', {
                                "hash": hash,
                                "message": str
                            });
                        }
                    });
                }
            });
        }
    });
});

const addServer = (hash, child, logDirectory) => {
    servers.set(hash, child);
    directories.set(hash, logDirectory);
}

const closedServer = (hash) => {
    console.log(`Closed: ${hash}`);
    hashes.delete(hash);
    listeners.get(hash).forEach((socket) => {
        socket.emit('close', {
            "hash": hash
        });
    });
    listeners.delete(hash);
    servers.delete(hash);
}

const listenServer = (hash, message) => {
    console.log(`${hash}: ${message}`);
    listeners.get(hash).forEach((socket) => {
        socket.emit('console', {
            "hash": hash,
            "message": message
        });
    });
}

const failedServer = (hash) => {
    console.log(`Failed: ${hash}`);
    hashes.delete(hash);
    listeners.get(hash).forEach((socket) => {
        socket.emit('fail', {
            "hash": hash
        });
    });
    listeners.delete(hash);
}