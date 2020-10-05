'use strict'

const express = require('express');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const qrcode = require('qrcode-terminal');

const SocketIO = require('socket.io');

const generateChecksum = require('./lib/common').generateChecksum;
const startPaper = require('./lib/minecraft/paper').startPaper;
const startSpigot = require('./lib/minecraft/spigot').startSpigot;
const config = require('./config.json');
const serverPort = config.port;

/**
 * Create express app
 */
const app = express();
var cors = require('cors');
app.use(cors({ credentials: true, origin: 'http://localhost:3000' }), express.static(path.join(process.cwd(), "public"), {
    index: config.index
}));

/**
 * Find local ip address from os network interfaces
 */
const ipRegex = /(^10\.)|(^172\.1[6-9]\.)|(^172\.2[0-9]\.)|(^172\.3[0-1]\.)|(^192\.168\.)/g
let localip;
for (let interfaces of Object.values(os.networkInterfaces())) {
    for (let network of interfaces) {
        if (ipRegex.test(network.address)) {
            localip = network.address;
        }
    }
}

/**
 * Default domain configuration. Uses local ip when no fqdn specified.
 */
let domain = config.fqdn;
let useDomain = false;
if (/^([^.]+\.)+([^.]+)$/g.test(domain)) {
    useDomain = true;
} else {
    domain = localip;
}

let server;
if (config.ssl) {
    /**
     * Start https server configuration (requires ssl_cert, ssl_key)
     */
    server = https.createServer({
        cert: fs.readFileSync(config.ssl_cert),
        key: fs.readFileSync(config.ssl_key)
    }, app).listen(serverPort, () => {
        console.log(`Server open at port ${serverPort} (https).`);
        qrcode.generate(`https://${domain}:${serverPort}`, (qrcode) => {
            console.log(qrcode);
        });
    });
} else {
    /**
     * Start http server configuration
     */
    server = http.createServer(app).listen(serverPort, () => {
        console.log(`Server open at port ${serverPort} (http),`);
    });
    qrcode.generate(`http://${domain}:${serverPort}`, (qrcode) => {
        console.log(`http://${domain}:${serverPort}`);
        console.log(qrcode);
    });
}

/**
 * Collections for servers (hash, port, listener, server, directory)
 */
const hashes = new Set();
const ports = new Map();
const listeners = new Map();
const servers = new Map();
const directories = new Map();

ports.set("server", serverPort);

/**
 * New websocket server
 */
const ws = SocketIO(server, {
    path: '/socket'
});

/**
 * Start listening from clients
 */
ws.on('connection', (socket) => {
    /**
     * On Disconnect
     */
    socket.on('disconnect', () => {
        listeners.forEach((value) => {
            if (value.has(socket)) {
                value.delete(socket);
            }
        });
    });

    /**
     * Create new server (param: name, version, port, memory, type)
     */
    socket.on('create', (data) => {
        const name = data.name;
        const version = data.version;
        const port = data.port;
        const memory = data.memory;
        const type = data.type;
        const checksum = generateChecksum(`${name}${version}${type}`).substring(0, 6);
        console.log(`${name} ${version} ${port} ${memory} ${type} ${checksum}`);
        if (Array.from(ports.values()).has(port) || hashes.has(checksum)) {
            socket.emit('err', {
                "reason": "Duplicate configuration"
            });
        } else {
            switch (type) {
                case 'paper':
                    startPaper(name, version, port, memory, checksum, addServer, listenServer, closedServer, failedServer);
                    break;
                case 'spigot':
                    startSpigot(name, version, port, memory, checksum, addServer, listenServer, closedServer, failedServer);
                    break;
                default:
                    socket.emit('err', {
                        "reason": `Unknown ${type}`
                    });
                    return;
            }
            hashes.add(checksum);
            listeners.set(checksum, new Set([socket]));
            ports.set(checksum, port);
            socket.emit('init', {
                "hash": checksum
            });
        }
    });

    /**
     * Subscribe to server (param: hash)
     */
    socket.on('subscribe', (data) => {
        const hash = data.hash;
        if (listeners.has(hash)) {
            listeners.get(hash).add(socket);
        }
    });

    /**
     * Unsubscribe from server (param: hash)
     */
    socket.on('unsubscribe', (data) => {
        const hash = data.hash;
        if (listeners.has(hash)) {
            listeners.get(hash).delete(socket);
        }
    });

    /**
     * Send message to server (param: hash, message)
     */
    socket.on('send', (data) => {
        const hash = data.hash;
        const message = data.message;
        if (servers.has(hash)) {
            servers.get(hash).stdin.write(`${message}\n`);
        }
    });

    /**
     * Get server log (param: hash)
     */
    socket.on('log', (data) => {
        const hash = data.hash;
        if (directories.has(hash)) {
            fs.readFile(path.join(directories.get(hash), "latest.log"), {
                encoding: 'utf8'
            }, (error, data) => {
                if (error) {
                    socket.emit('err', {
                        "reason": "Unable to open log"
                    });
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

/**
 * Call when server's init progress started.
 * 
 * @param {String} hash server's hash
 * @param {import('child_process').ChildProcess} child server's child process
 * @param {String} logDirectory server's log directory
 */
const addServer = (hash, child, logDirectory) => {
    servers.set(hash, child);
    directories.set(hash, logDirectory);
}

/**
 * Call when the server has closed.
 * 
 * @param {String} hash server's hash 
 */
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
    ports.delete(hash);
    directories.delete(hash);
}

/**
 * Call when new message needs to be announced.
 * 
 * @param {String} hash server's hash
 * @param {String} messages message to be announced
 */
const listenServer = (hash, message) => {
    console.log(`${hash}: ${message}`);
    listeners.get(hash).forEach((socket) => {
        socket.emit('console', {
            "hash": hash,
            "message": message
        });
    });
}

/**
 * Call when failed to initialize server
 * 
 * @param {String} hash server's hash
 */
const failedServer = (hash) => {
    console.log(`Failed: ${hash}`);
    hashes.delete(hash);
    listeners.get(hash).forEach((socket) => {
        socket.emit('fail', {
            "hash": hash
        });
    });
    listeners.delete(hash);
    ports.delete(hash);
}