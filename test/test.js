'use strict'

const startPaper = require('../lib/minecraft/paper').startPaper;

const cs = require('../lib/minecraft/common').checkSum;

const name = "Nitro";

cs('./build/jars/paper_1.13.2.jar');

/*
startPaper(name, "1.13.2", 25565, 3072, false);
startPaper(name, "1.15.2", 25575, 3072, false);
startPaper(name, "1.16.3", 25585, 3072, false);
*/