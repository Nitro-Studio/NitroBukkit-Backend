'use strict'

const axios = require('axios');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const buildDir = checkDir(path.join(__dirname, 'build'));
const jarsDir = checkDir(path.join(buildDir, 'jars'));
const serversDir = checkDir(path.join(buildDir, 'servers'));
const cacheDir = checkDir(path.join(jarsDir, 'cache'));

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
            console.log(`Latest paper ${version} already exists...`);
        } else {
            console.log(`Downloading paper ${version}...`);
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
                console.log(`Patching paper ${version}...`);
                const child = child_process.exec(`java -Dpaperclip.patchonly=true -jar ${jar}`, {
                    cwd: jarsDir
                });
                child.on('exit', () => {
                    fs.unlink(path.join(cacheDir, `mojang_${version}.jar`), (error) => {
                        if (error) {
                            flag = false;
                            console.log(error);
                        }
                        if (flag == true) {
                            resolve();
                        } else {
                            reject();
                        }
                    });
                })
            })
        } else if (flag == true) {
            resolve();
        } else {
            reject();
        }
    });
}

function startPaper(name, version, syncWithProcess) {
    downloadPaper(version).then(() => {
        const jar = path.join(jarsDir, `paper_${version}.jar`);
        const server = checkDir(path.join(serversDir, `paper_${version}_${name}`));
        const cache = checkDir(path.join(server, "cache"));

        fs.copyFileSync(path.join(cacheDir, `patched_${version}.jar`), path.join(cache, `patched_${version}.jar`));

        console.log(`Starting paper ${version} (Server name: ${name})...`);
        const child = child_process.exec("java -Xms4G -Xmx4G -Xmn3G " +
            "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 " +
            "-XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch " +
            "-XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 " +
            "-XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 " +
            "-XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 " +
            "-XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 " + 
            "-Dfile.encoding=UTF-8 -Dcom.mojang.eula.agree=true " + 
            "-Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true " + 
            `-jar ${jar} --world-dir worlds/ nogui`, {
            cwd: server
        });

        if (syncWithProcess) {
            child.stdout.pipe(process.stdout)
            const readInterface = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                terminal: false
            });
            readInterface.on('line', function (line) {
                child.stdin.write(`${line}\n`);
            });
            child.on('exit', () => {
                process.exit();
            });
        }
    }).catch((error) => {
        console.error(error);
    });
}

const name = "Nitro";
const version = "1.12.2";

startPaper(name, version, true);