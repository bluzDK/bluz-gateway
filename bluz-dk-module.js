'use strict';

var noble = require('noble');
var util = require('util');
var log = require('loglevel');
var net = require('net');
var settings = require('./settings.js');

var BLUZ_SERVICE_UUID = '871e022338ff77b1ed419fb3aa142db2';
var BLUZ_WRITE_CHAR = '871e022538ff77b1ed419fb3aa142db2';
var BLUZ_READ_CHAR = '871e022438ff77b1ed419fb3aa142db2';

function BluzDKModule(peripheral, destroycallback) {

  var instance = this;

  this.connectedTime = Date.now();
  this.clientStatus = 0; // 0 -> disconnected, 1-> connecting, 2-> connected

  this.writeBuffer = [];
  this.writing = false;

  this.destroycallback = destroycallback;
  this.peripheral = peripheral;
  this.id = peripheral.id;
  this.connected = true;

  this.particleId = null;
  this.rssi = null;

  // Characteristics
  this.writeToDkCharacteristic = null;
  this.readFromDkCharacteristic = null;

  // Cloud Client
  this.client = new net.Socket();

  // Buffer for incoming from DK
  this.lastService = 0x00;
  this.ulBuffer = new Buffer(512);
  this.ulBuffer.fill(0);
  this.ulBufferLength = 0;

  // setup cloud client
  this.client.on('connect', function (data) {
    instance.clientStatus = 2;
    log.info('Bluz ' + instance.id + ':', 'cloud client connected');
  });

  this.client.on('data', function (data) {
    log.debug('Bluz ' + instance.id + ':', 'Received from spark.io:', data);
    var header = new Buffer([0x01, 0x00]);
    instance.writeToDK(data, header);
  });

  this.client.on('close', function () {
    instance.clientStatus = 0;
    log.info('Bluz ' + instance.id + ':', 'Cloud connect closed');
    if (instance.connected) {
      log.info('Bluz ' + instance.id + ':', 'trying to reconnect cloud in 1 second');

      setTimeout(function () {
        if (instance.connected) {
          log.info('Bluz ' + instance.id + ':', 'cloud reconnecting...');

          instance.clientconnect();
        }
      }, 1000);
    }
  });

  this.client.on('error', function (err) {
    log.error('Bluz ' + instance.id + ':', 'cloud error:', err);
  });

  this.connectToDK();

  this.updateRssi();

};

BluzDKModule.prototype.writeNext = function (keepWriting, callback) {
  if (!this.connected) {
    // not connected
    return;
  }
  if (this.writing && !keepWriting) {
    // currently writing, and not called by ourself
    return;
  }
  this.writing = true;
  if (this.writeBuffer.length < 1) {
    // no more to write
    this.writing = false;
    return;
  }
  var instance = this;
  var nextData = this.writeBuffer.shift();
  if (typeof (nextData) === 'undefined') { //this really shouldn't happen
    return this.writeNext(true);
  }
  // we've reached here, let's write
  log.debug('Bluz ' + instance.id + ': writing:', nextData);
  this.writeToDkCharacteristic.write(nextData, true, function (error) {
    if (error) {
      log.error('Bluz ' + instance.id + ' Error :', error);
    }
    setTimeout(function() {instance.writeNext(true); }, 5); // TODO: this timeout shouldn't be necessary (in theory)
    // instance.writeNext(true);
  });
};

BluzDKModule.prototype.updateRssi = function () {
  var instance = this;
  if (this.connected) this.peripheral.updateRssi(function (error, rssi) {
    instance.rssi = rssi;
    log.debug('Bluz ' + instance.id + ': RSSI:', rssi);
    setTimeout(function () {
      instance.updateRssi()
    }, 10000);
  });
}

var discoverCharacteristics = function (instance, error, characteristics) {
  characteristics.forEach(function (characteristic) {
    // Loop through each characteristic and match them to the
    // UUIDs that we know about.
    //
    log.debug('Bluz ' + instance.id + ':', 'found characteristic:', characteristic.uuid);

    if (BLUZ_READ_CHAR == characteristic.uuid) {
      instance.readFromDkCharacteristic = characteristic;

      log.info('Bluz ' + instance.id + ':', 'read character found');
      log.debug('Bluz ' + instance.id + ':', characteristic.properties);

      characteristic.discoverDescriptors(function (error, descriptors) {

        descriptors.forEach(function (descriptor) {
          log.debug('Bluz ' + instance.id + ':', descriptor);
          if (descriptor.uuid == 2902) {
            log.debug('Bluz ' + instance.id + ':', "write descriptor");

            descriptor.once('valueWrite', function () {
              log.info('Bluz ' + instance.id + ':', 'wrote descriptor');
              instance.setupDkReaders(characteristic, function () {
                var requestIdBuffer = new Buffer([0x02, 0x00]);
                instance.writeToDK(requestIdBuffer, null, function () {
                  setTimeout(function () {
                    instance.clientconnect();
                  }, 3000);
                });
              });
              //~ 
              //~ setTimeout(function() {	this.clientconnect(); }, 3000);
            });
            descriptor.writeValue(new Buffer([0x01, 0x00]), function (error) {
              if (error)
                log.error('Bluz ' + instance.id + ':', 'descript error', error);
            });
          };

        });
      });

    } else if (BLUZ_WRITE_CHAR == characteristic.uuid) {
      instance.writeToDkCharacteristic = characteristic;
      log.info('Bluz ' + instance.id + ':', 'write character found');
      log.debug('Bluz ' + instance.id + ':', characteristic.properties);
    }
  })
}

var discoverServices = function (instance, error, services) {
  services.forEach(function (service) {
    //
    // This must be the service we were looking for.
    //
    log.debug('Bluz ' + instance.id + ':', 'found service:', service.uuid);
    //
    // So, discover its characteristics.
    //
    service.discoverCharacteristics([], function (err, characteristics) {
      discoverCharacteristics(instance, err, characteristics);
    });
    /*
     * TODO: Fix this
    if(this.readFromDkCharacteristic && this.writeToDkCharacteristic) {
    }
    else {
    	console.log ('missing characteristics');
    	peripheral.disconnect();
    }
    * */

  })
}

BluzDKModule.prototype.connectToDK = function () {
  var instance = this;

  // setup peripheral
  this.peripheral.once('disconnect', function () {
    log.info('Bluz ' + instance.id + ' Disconnected');
    instance.connected = false;

    instance.client.end();

    //setTimeout(function() {
    //    if (instance.destroycallback()) instance.destroycallback
    //}, 1000);

    instance.destroycallback();
  });

  instance.peripheral.discoverServices([BLUZ_SERVICE_UUID], function (error, services) {
    discoverServices(instance, error, services)
  });

};

BluzDKModule.prototype.clientconnect = function () {
  var instance = this;
  if (this.clientStatus == 1) {
    log.debug('Bluz ' + instance.id + ':', 'still connecting to cloud...')
  } else if (this.clientStatus == 0) {
    log.info('Bluz ' + instance.id + ':', 'connecting to cloud...')
    this.client.connect(settings.get('cloud:port'), settings.get('cloud:host'));
  }
};

//BluzDKModule.prototype.safeWrite = function (data) {
//  if (this.connected) {
//    this.writeToDkCharacteristic.write(data, true);
//  };
//};

BluzDKModule.prototype.writeToDK = function (data, header, callback) {
  var instance = this;
  if (!this.connected) {
    log.info('not currently connected, not going to try writing');
    return;
  }
  if (this.writeToDkCharacteristic == null) {
    log.info('Bluz ' + instance.id + ':', 'Tried to write data but not connected to DK',
      data);
  } else {
    var maxChunk = 960;

    for (var chunkPointer = 0; chunkPointer < data.byteLength; chunkPointer += maxChunk) {
      log.debug('Bluz ' + instance.id + ':', 'Chunk Pointer', chunkPointer);
      var chunkLength = (data.byteLength - chunkPointer > maxChunk ? maxChunk : data.byteLength - chunkPointer);
      log.debug('Bluz ' + instance.id + ':', 'ChunkLength', chunkLength);
      if (header != null) {
        //this.safeWrite(header);
        this.writeBuffer.push(header);
        log.debug('Bluz ' + instance.id + ':', 'Sent header to Buffer');
      }
      for (var i = 0; i < chunkLength; i += 20) {
        var size = (chunkLength - i > 20 ? 20 : chunkLength - i);
        var tmpBuffer = new Buffer(size);
        var originalIndex = 0;
        for (var j = i; j < i + size; j++) {
          tmpBuffer[originalIndex] = data[chunkPointer + j];
          originalIndex++;
        }

        log.debug('Bluz ' + instance.id + ':', 'Writing this to Buffer:', tmpBuffer);
        //this.safeWrite(tmpBuffer);
        this.writeBuffer.push(tmpBuffer);
      }

      var eosBuffer = new Buffer([0x03, 0x04]);
      log.info('Bluz ' + instance.id + ':', 'Wrote Data and EOS to Buffer, total data length:', chunkPointer + chunkLength);
      //this.safeWrite(eosBuffer);
      this.writeBuffer.push(eosBuffer);
    }
  }
  this.writeNext();
  if (callback) callback();
};

BluzDKModule.prototype.setupDkReaders = function (characteristic, callback) {
  var instance = this;
  characteristic.read();
  // true to enable notify
  characteristic.notify(true, function (error) {
    log.debug('Bluz ' + instance.id + ':', 'notify on');
    if (callback) callback();
  });
  characteristic.on('data', function (data, isNotification) {
    instance.processData(data);
  });

  characteristic.on('notify', function (state) {
    log.debug('Bluz ' + instance.id + ':', 'notified');
  });
};

BluzDKModule.prototype.processData = function (data) {

  var instance = this;
  log.debug('Bluz ' + instance.id + ':', 'recieved from Bluz', data);
  this.ulBufferLength = Math.max(0, this.ulBufferLength); // Possibly HACK: would only happen if byte length < header Bytes
  if (data[0] == 0x03 && data[1] == 0x04) {
    log.debug('Bluz ' + instance.id + ':', 'end of bluz message');
    var tmpBuffer = new Buffer(this.ulBufferLength);
    this.ulBuffer.copy(tmpBuffer, 0, 0, this.ulBufferLength);
    if (this.lastService == 0x01) {
      log.info('Bluz ' + instance.id + ':', "Got a full buffer, attempting to send it up, length:", this.ulBufferLength);
      this.writeToCloud(tmpBuffer);
    } else if (this.lastService == 0x02) {
      log.warn('Bluz ' + instance.id + ':', "Device ID:", tmpBuffer.toString('hex'));
      this.particleId = tmpBuffer.toString('hex');
    }
    this.ulBuffer.fill(0);
    this.ulBufferLength = 0;
  } else {

    if (this.ulBufferLength == 0) {
      this.lastService = data[0];
      var headerBytes = 1;
      if (this.lastService == 0x01) {
        headerBytes = 2;
      }
      //this is the first packet in the stream. check the header
      data.copy(this.ulBuffer, this.ulBufferLength, headerBytes);

      this.ulBufferLength += (data.byteLength - headerBytes);
    } else {
      try {
        data.copy(this.ulBuffer, this.ulBufferLength);
      } catch (err) {
        // this shouldn't be needed any more
        log.error(err);
        log.error(this.ulBuffer, this.ulBufferLength);
      }

      this.ulBufferLength += (data.byteLength);
    }
  }
};

BluzDKModule.prototype.writeToCloud = function (data) {
  var instance = this;
  if (this.clientStatus != 2) {
    log.info('Bluz ' + instance.id + ':', 'Not connected to cloud, trying to connect');
    this.clientconnect();
  } else {
    log.debug('Bluz ' + instance.id + ':', 'Writing to cloud: ', data);
    this.client.write(data, null);
  }
};

BluzDKModule.prototype.shutDown = function () {
  this.peripheral.disconnect();
}

module.exports = BluzDKModule;
