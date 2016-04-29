'use strict';
var fs = require('fs');
var settings = require('nconf');
var os = require('os');
var path = require('path');
var log = require('loglevel');

var mkdirSync = function (path) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code != 'EEXIST') throw e;
  }
}

var homedir = os.homedir();
var settingsDir = path.join(homedir, '.bluz-gw');
mkdirSync(settingsDir);
var settingsFile = path.join(settingsDir, 'config.json');

var defaultSettings = {
  'serverPort': 3000,
  'cloud:host': 'device.spark.io',
  'cloud:port': 5683,
  'blacklist': [], // note: based on BL MAC Address
  'serverEnabled': true,
  'DEBUG': 'warn'
}

settings.argv();
settings.env();
settings.file(settingsFile);

for (var key in defaultSettings) {
  if (typeof settings.get(key) === "undefined")
    settings.set(key, defaultSettings[key])
}

settings.saveSettings = function () {
  this.save(function (err) {
    if (err) {
      log.error(err.message);
      return;
    }
    log.info('Configuration saved successfully.');
  });
}

settings.saveSettings();

module.exports = settings;
