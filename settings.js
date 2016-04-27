'use strict';
var fs = require('fs');
var settings = require('nconf');
var os = require('os');
var path = require('path');

var mkdirSync = function (path) {
  try {
    fs.mkdirSync(path);
  } catch(e) {
    if ( e.code != 'EEXIST' ) throw e;
  }
}

var homedir = os.homedir();
//~ console.log(homedir);
var settingsDir=path.join(homedir, '.bluz-gw');

mkdirSync(settingsDir);

var settingsFile = path.join(settingsDir,'config.json');

var defaultSettings = {
    'serverPort': 3000,
    'cloud:host': 'device.spark.io',
    'cloud:port': 5683,
    'blacklist': [],  // note: based on BL MAC Address
    'serverEnabled': true,
    'debug': 'debug'
}

settings.argv();
settings.env();
settings.file(settingsFile);

for (var key in defaultSettings) {
    if(!settings.get(key))
        settings.set(key, defaultSettings[key])
}
//~ console.log(settings.get());


settings.saveSettings=function() {
    //~ console.log(this);
    this.save(function (err) {
         if (err) {
      console.error(err.message);
      return;
    }
    console.log('Configuration saved successfully.');
    });
}

settings.saveSettings();

module.exports = settings;
