const fs = require('fs');
const http = require('http');
const https = require('https');

async function download(url, filePath) {

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    const fileInfo = null;

    const request = https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
        return;
      }

      fileInfo = {
        mime: response.headers['content-type'],
        size: parseInt(response.headers['content-length'], 10),
      };

      response.pipe(file);
    });

    // The destination stream is ended by the time it's called
    file.on('finish', () => resolve(fileInfo));

    request.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    file.on('error', err => {
      fs.unlink(filePath, () => reject(err));
    });

    request.end();
  });
}


const exec = require('child_process').exec;

const jarName = ".server/paper.jar"

download("https://papermc.io/api/v1/paper/1.16.3/latest/download", jarName);

const child = exec(`java -Xms3G -Xmx3G -Xmn2G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dfile.encoding=UTF-8 -Dcom.mojang.eula.agree=true -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -jar ${jarName} --world-dir worlds/ nogui`)
child.stdin.pipe(process.stdin)
child.stdout.pipe(process.stdout)
child.on('exit', function () {
    process.exit()
})