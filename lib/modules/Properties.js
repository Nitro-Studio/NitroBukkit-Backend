var properties = require('properties-reader');
// https://www.npmjs.com/package/properties-reader

var mcProperties = properties('../properties/server.properties');
console.log(mcProperties._properties['gamemode'])