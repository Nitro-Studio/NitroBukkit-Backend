'use strict'

const axios = require('axios');
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const checkDir = require('../common').checkDir;
const newDownload = require('./download').newDownload;

const buildDir = checkDir(path.join(process.cwd(), 'build'));
const jarsDir = checkDir(path.join(buildDir, 'jars'));
const toolsDir = checkDir(path.join(buildDir, 'tools'));
const cacheDir = checkDir(path.join(toolsDir, 'cache'));
const serversDir = checkDir(path.join(buildDir, 'servers'));

const buildToolsJar = path.join(toolsDir, `BuildTools.jar`);

async function downloadBuildTools() {
    const log = path.join(toolsDir, `BuildTools.log`);
    const url = 'https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar';

    let flag = true;
    let stream;

    await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    }).then((response) => {
        let last = "";
        try {
            last = fs.readFileSync(log, 'utf8')
        } catch(ignored) {}
        const time = response.headers['last-modified'];
        if (time == last) {
            onConsole('Latest BuildTools already exists...');
        } else {
            onConsole('Downloading BuildTools...');
            fs.writeFile(log, time, (error) => {
                if (error) {
                    flag = false;
                    onConsole(error);
                }
            });
            stream = response.data.pipe(fs.createWriteStream(buildToolsJar));
        }
    }).catch((error) => {
        flag = false;
        onConsole(error);
    });

    return new Promise((resolve, reject) => {
        if (typeof stream !== 'undefined' && stream) {
            stream.on('close', () => {
                if (flag == true) {
                    onConsole('Finished downloading BuildTools...');
                    resolve();
                } else {
                    reject();
                }
            });
        } else if (flag == true) {
            resolve();
        } else {
            reject();
        }
    });
}

async function downloadSpigot(config) {
    const version = config.version;
    const memory = config.memory;
    return new Promise((resolve, reject) => {
        downloadBuildTools().then(() => {
            let flag = true;
            if (fs.existsSync(path.join(jarsDir, `spigot-${version}.jar`))) {
                onConsole(`Spigot ${version} already exists...`);
            } else {
                onConsole(`Downloading spigot ${version}...`);
                const child = child_process.exec(`java -Xms${memory}M -Xmx${memory}M -jar ${buildToolsJar} --rev ${version} --output-dir ${jarsDir}`, {
                    cwd: cacheDir
                });
                child.on('exit', (code) => {
                    if (code != 0) {
                        flag = false;
                        fs.unlink(path.join(jarsDir, `spigot-${version}.jar`), () => {});
                    }
                    fs.rmdir(cacheDir, {
                        recursive: true
                    }, () => {});
                    fs.unlink(path.join(jarsDir, `craftbukkit-${version}.jar`), () => {});
                    if (flag == true) {
                        onConsole(`Finished downloading spigot ${version}...`);
                        resolve();
                    } else {
                        reject();
                    }
                })
            }
        }).catch((error) => {
            onConsole(error);
            reject();
        })
    })
}

exports.startSpigot = async (name, version, port, memory, hash, onStart, onConsole, onClose) => {
    newDownload(downloadSpigot, { version: version, memory: memory}, (success) => {
        if (success == true) {
            const jar = path.join(jarsDir, `spigot-${version}.jar`);
            const server = checkDir(path.join(serversDir, `spigot_${version}_${name}`));
            const worlds = checkDir(path.join(server, "worlds"));
            const plugins = checkDir(path.join(server, "plugins"));
            const startDir = checkDir(path.join(server, "configurations"));

            onConsole(`Starting paper ${version} (Server name: ${name})...`);
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

            onStart(hash, child);
            child.stdout.on('data', (data) => {
                onConsole(hash, data);
            });
            child.on('exit', () => {
                onClose(hash);
            });
        } else {
            onConsole(`Failed to download spigot ${version}`);
        }
    });
}