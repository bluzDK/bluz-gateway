#!/usr/bin/env node

'use strict';

var noble = require('noble');
var log = require('loglevel');
var settings = require('./settings.js');
var BluzDKModule = require('./bluz-dk-module.js');
var EOL = require('os').EOL;

var debuglevel = settings.get('DEBUG');
var loggingLevels = ['trace', 'debug', 'info', 'warn', 'error'];
if (loggingLevels.indexOf(debuglevel) > -1) {
  log.setDefaultLevel(debuglevel);
} else {
  log.setDefaultLevel('error');
}

var peripheralList = {};
var shuttingDown = false;
var scanning = false;
var BLUZ_SERVICE_UUID = '871e022338ff77b1ed419fb3aa142db2';

noble.on('stateChange', function (state) {
  if (state === 'poweredOn') {
    startScanHelper();
  } else {
    stopScanHelper();
  }
});

function startScanHelper() {
  if (shuttingDown || scanning)
    return;
  scanning = true;
  if (noble.state === 'poweredOn')
    noble.startScanning([], true);
}

function stopScanHelper() {
  if (!scanning)
    return;
  scanning = false;
  noble.stopScanning();
}

noble.on('warning', function (message) {
  log.warn('Master: noble warning:', message)
});

var server = require('./info-server.js')(peripheralList);

function deletePeripheral(id) {
  // TODO: Replace with event based deletion

  stopScanHelper(); // Not sure if necessary, but probably doesn't hurt
  if (peripheralList[id]) {
    log.info('Master: Removing peripheral:', id);
    delete peripheralList[id].dkModule;
    delete peripheralList[id];
  }
  startScanHelper();
}

// Discovery
noble.on('discover', function (peripheral) {
  if (!peripheralList[peripheral.id] && settings.get('blacklist').indexOf(peripheral.id) < 0) {
    //~ log.info(peripheral);
    //~ process.exit();
    stopScanHelper(); // turn off scanning while connecting HACK?

    log.info('Master: Found peripheral with ID: ' + peripheral.id + ' and Name: ' + peripheral.advertisement.localName);

    peripheralList[peripheral.id] = {
      found: true,
      dkModule: null,
      name: peripheral.advertisement.localName
    };

    peripheral.connect(function (error) {
      peripheral.discoverServices([BLUZ_SERVICE_UUID], function (error, services) {
        if (error)
          log.error('Master: Discover services error:', error);
        log.trace(services);

        if (services.length > 0) {
          log.info('Master: Peripheral a bluz');
          var bluzMod = new BluzDKModule(peripheral, function () {
            deletePeripheral(peripheral.id);
          });

          peripheralList[peripheral.id].dkModule = bluzMod;
        } else {
          log.info('Master: Peripheral not a Bluz');
          peripheral.disconnect();
        }

        startScanHelper(); // connected, resume scanning
      });

    });
  }
});

// Program Exit Handling
if (process.platform === "win32") {
  var rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

process.on("SIGINT", processExitHandler);

process.on("SIGTERM", processExitHandler);

process.stdout.on('error', function (err) {
  // Handle Ctrl-C (SIGINT) when piped to another command
  if (err.code == "EPIPE") {
    processExitHandler();
  }
});

function processExitHandler() {
  //graceful shutdown
  log.warn();
  log.warn('Master: Shutting Down');

  shuttingDown = true;
  stopScanHelper();
  for (var key in peripheralList) {

    if (peripheralList[key].dkModule != null) {
      log.info('Master: Shutting Down', key);

      peripheralList[key].dkModule.shutDown();
    } else {
      delete(peripheralList[key]);
    }
  }
  server.close();
  setTimeout(processExitChecker, 1000); // graceful check
  setTimeout(function () {
    log.warn('Master: Hard Shutdown');
    process.exit();
  }, 10000); // hard shutdown failsafe
}

function processExitChecker() {
  var numLeft = Object.keys(peripheralList).length;
  log.info('Master: ', numLeft, 'peripherals left');
  if (numLeft == 0) {
    log.warn('Master: Shutdown');
    process.exit()
  } else {
    setTimeout(processExitChecker, 1000);
  }
}
