const readline = require('readline');
const exec = require('child_process').exec;

const jarName = ".server/paper.jar"

const child = exec(`java -Xms4G -Xmx4G -Xmn3G -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dfile.encoding=UTF-8 -Dcom.mojang.eula.agree=true -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -jar ${jarName} --world-dir worlds/ nogui`)
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