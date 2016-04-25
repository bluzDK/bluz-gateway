//var async = require('async');
var noble = require('noble');

//var sleep = require('sleep');
//var net = require('net');


var log = require('loglevel')
log.setDefaultLevel('debug');

var BluzDKModule = require('./bluz-dk-module.js');

const BLUZ_SERVICE_UUID = '871e022338ff77b1ed419fb3aa142db2';
// const BLUZ_SERVICE_UUID = '871e022338ff77b1ed419fb3aa142db3'; // WRONG: USED FOR TESTING ONLY

//~ var BLUZ_WRITE_CHAR = '871e022538ff77b1ed419fb3aa142db2';
//~ var BLUZ_READ_CHAR = '871e022438ff77b1ed419fb3aa142db2';



noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        startScanning();
    } else {
        noble.stopScanning();
    }

});

function startScanning() {
    noble.startScanning([], true);
};

noble.on('warning', function(message) {
    log.info('Master noble warning:', message)
});


var peripheralList = [];

var removing = [];

function deletePeripheral(id) {
    // TODO: Replace with event based deletion
    if (!removing[id]) {
        removing[id] = true;
    } else {
        return;
    }
    if (peripheralList[id]) {

        log.info('removing peripheral', id);
        delete peripheralList[id].dkModule;
        setTimeout(function() {
            delete peripheralList[id];
            delete removing[id];
        }, 1500);
    }
}

noble.on('discover', function(peripheral) {
    if (!peripheralList[peripheral.id]) {

        noble.stopScanning(); // turn off scanning while connecting HACK?

        log.info('Master found peripheral with ID ' + peripheral.id + ' and Name ' + peripheral.advertisement.localName);

        peripheralList[peripheral.id] = {
            found: true,
            dkModule: null
        };

        peripheral.connect(function(error) {
            peripheral.discoverServices([BLUZ_SERVICE_UUID], function(error, services) {

                log.trace(services);
                startScanning(); // connected, resume scanning
                if (services.length > 0) {
                    log.info('Peripheral a bluz');
                    var bluzMod = new BluzDKModule(peripheral, function() {
                        deletePeripheral(peripheral.id);
                    });
                    //~ 
                    peripheralList[peripheral.id].dkModule = bluzMod;
                } else {
                    log.info('Peripheral not a Bluz');
                    peripheral.disconnect();
                }
            });

        });
    }
});