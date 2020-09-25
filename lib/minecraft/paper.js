'use strict'

const axios = require('axios');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const checkDir = require('../common').checkDir;
const updateJarList = require('../common').updateJarList;
const newDownload = require('./download').newDownload;

const buildDir = checkDir(path.join(process.cwd(), 'build'));
const jarsDir = checkDir(path.join(buildDir, 'jars'));
const serversDir = checkDir(path.join(buildDir, 'servers'));
const cacheDir = checkDir(path.join(jarsDir, 'cache'));

const downloadPaper = async (config) => {
    const version = config.version;
    const memory = config.memory;
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
            });
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
                const child = child_process.exec(`java -Xms${memory}M -Xmx${memory}M -Dpaperclip.patchonly=true -jar ${jar}`, {
                    cwd: jarsDir
                });
                child.on('exit', () => {
                    fs.unlink(path.join(cacheDir, `mojang_${version}.jar`), (error) => {
                        if (error) {
                            flag = false;
                            console.error(error);
                        }
                        if (flag == true) {
                            // updateJarList(jar, `paper_${version}.jar`, version);
                            resolve();
                        } else {
                            reject();
                        }
                    });
                });
            });
        } else if (flag == true) {
            // updateJarList(jar, `paper_${version}.jar`, version);
            resolve();
        } else {
            reject();
        }
    });
}

exports.startPaper = async (name, version, port, memory, hash, onStart, onConsole, onClose) => {
    newDownload(downloadPaper, { version: version, memory: memory}, (success) => {
        if (success == true) {
            const jar = path.join(jarsDir, `paper_${version}.jar`);
            const server = checkDir(path.join(serversDir, `paper_${version}_${name}`));
            const worlds = checkDir(path.join(server, "worlds"));
            const plugins = checkDir(path.join(server, "plugins"));
            const startDir = checkDir(path.join(server, "configurations"));
            const cache = checkDir(path.join(startDir, "cache"));

            fs.copyFileSync(path.join(cacheDir, `patched_${version}.jar`), path.join(cache, `patched_${version}.jar`));

            onConsole(hash, `Starting paper ${version} (Server name: ${name})...`);
            const child = child_process.exec(`java -Xms${memory}M -Xmx${memory}M ` +
                "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 " +
                "-XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch " +
                "-XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 " +
                "-XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 " +
                "-XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 " +
                "-XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 " + 
                "-Dfile.encoding=UTF-8 -Dcom.mojang.eula.agree=true " + 
                "-Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true " + 
                `-jar ${jar} --port ${port} --plugins ${plugins} --world-dir ${worlds} nogui`, {
                cwd: startDir
            });

            onStart(hash, child, checkDir(path.join(startDir, "logs")));
            child.stdout.on('data', (data) => {
                data.split(/\r\n|\n/).forEach((str) => {
                    if (str && !/^\s*$/.test(str)) {
                        onConsole(hash, str);
                    }
                });
            });
            child.on('exit', () => {
                onClose(hash);
            });
        } else {
            onConsole(hash, `Failed to download paper ${version}`);
        }
    });
}