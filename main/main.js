'use strict'

const axios = require('axios');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const buildDir = checkDir(path.join(__dirname, 'build'));
const jarsDir = checkDir(path.join(buildDir, 'jars'));
const serversDir = checkDir(path.join(buildDir, 'servers'));

function checkDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    return dir;
}

async function downloadPaper(version) {
    const jar = path.join(jarsDir, `paper_${version}.jar`);
    const log = path.join(jarsDir, `paper_${version}.log`);
    const url = `https://papermc.io/api/v1/paper/${version}/latest/download`;

    let flag = true;
    let stream;

    await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    }).then((response) => {
        let last = "";
        try {
            last = fs.readFileSync(log, 'utf8');
        } catch(ignored) {}
        const time = response.headers['last-modified'];
        if (time == last) {
            console.log(`Paper ${version} already exists...`)
        } else {
            console.log(`Paper ${version} downloading...`)
            fs.writeFile(log, time, (error) => {
                if (error) {
                    flag = false;
                    console.error(error);
                }
            })
            stream = response.data.pipe(fs.createWriteStream(jar));
        }
    }).catch((error) => {
        flag = false;
        console.error(error);
    });

    return new Promise((resolve, reject) => {
        if (typeof stream !== 'undefined' && stream) {
            stream.on('close', () => {
                if (flag == true) {
                    resolve()
                } else {
                    reject()
                }
            })
        } else if (flag == true) {
            resolve()
        } else {
            reject()
        }
    });
}

const name = "Nitro";
const version = "1.15.2";

downloadPaper(version).then(() => {
    console.log(`Paper ${version} download success`);

    const jar = path.join(jarsDir, `paper_${version}.jar`);
    const server = checkDir(path.join(serversDir, name));

    console.log(jar);
    console.log(server);
    const child = child_process.exec(`java -Xms4G -Xmx4G -Xmn3G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dfile.encoding=UTF-8 -Dcom.mojang.eula.agree=true -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -jar ${jar} --world-dir worlds/ nogui`, {
        cwd: server
    });
    child.stdout.pipe(process.stdout)
    const readInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });
    readInterface.on('line', function (line) {
        child.stdin.write(`${line}\n`);
    });
    child.on('exit', function () {
        process.exit()
    });
}).catch(() => {
    console.error("failed");
});