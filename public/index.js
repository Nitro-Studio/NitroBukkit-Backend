'use strict'

const socket = io.connect(`${location.protocol}//${location.host}`, {
    path: '/socket',
});

socket.on('init', (data) => {
    const console = document.getElementById("console");
    console.innerHTML = `${console.innerHTML}<p class="notice">Initialized: ${data.hash}</p>`
    console.scrollTo(0, console.scrollHeight);
});

socket.on('err', (data) => {
    const console = document.getElementById("console");
    console.innerHTML = `${console.innerHTML}<p class="notice">Error: ${data.hash} -> ${data.reason}</p>`
    console.scrollTo(0, console.scrollHeight);
});

socket.on('close', (data) => {
    const console = document.getElementById("console");
    console.innerHTML = `${console.innerHTML}<p class="notice">Closed: ${data.hash}</p>`
    console.scrollTo(0, console.scrollHeight);
});

socket.on('fail', (data) => {
    const console = document.getElementById("console");
    console.innerHTML = `${console.innerHTML}<p class="notice">Failed: ${data.hash}</p>`
    console.scrollTo(0, console.scrollHeight);
});

socket.on('console', (data) => {
    const console = document.getElementById("console");
    console.innerHTML = `${console.innerHTML}<xmp>${data.hash}: ${data.message}</xmp>`
    console.scrollTo(0, console.scrollHeight);
});

function send() {
    const textbox = document.getElementById("textbox");
    if (textbox.value !== "") {
        if (textbox.value.startsWith('/')) {
            const hash = textbox.value.substring(1, 7);
            const message = textbox.value.substring(8);
            socket.emit('send', {
                "hash": hash,
                "message": message
            });
        }
        if (textbox.value.startsWith('!')) {
            const params = textbox.value.substring(1).split(' ');
            const name = params[0];
            const version = params[1];
            const port = params[2];
            const memory = params[3];
            const type = params[4];
            socket.emit('create', {
                "name": name,
                "version": version,
                "port": port,
                "memory": memory,
                "type": type
            });
        }
        if (textbox.value.startsWith('>')) {
            const params = textbox.value.substring(1).split(' ');
            const action = params[0];
            const hash = params[1];
            socket.emit(action, {
                "hash": hash
            });
        }
        textbox.value = "";
    }
}