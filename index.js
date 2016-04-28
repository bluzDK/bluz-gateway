#!/usr/bin/env node

var noble = require( 'noble' );
var express = require( 'express' );
var log = require( 'loglevel' );
var settings = require( './settings.js' );
var BluzDKModule = require( './bluz-dk-module.js' );

var debuglevel = settings.get( 'DEBUG' );
var loggingLevels = [ 'trace', 'debug', 'info', 'warn', 'error' ];
if ( loggingLevels.indexOf( debuglevel ) > -1 ) {
  log.setDefaultLevel( debuglevel );
} else {
  log.setDefaultLevel( 'error' );
}

var server = express( );

const BLUZ_SERVICE_UUID = '871e022338ff77b1ed419fb3aa142db2';

var serverPort = settings.get( 'serverPort' );

noble.on( 'stateChange', function ( state ) {
  if ( state === 'poweredOn' ) {
    startScanning( );
  } else {
    noble.stopScanning( );
  }

} );

function startScanning( ) {
  noble.startScanning( [ ], true );
};

noble.on( 'warning', function ( message ) {
  log.warn( 'Master: noble warning:', message )
} );

var peripheralList = {};
var shuttingDown = false;

server.get( '/connected-devices', function ( req, res ) {
  var jsonreturn = {};
  log.debug( 'Server Got request with headers', req.headers );
  //    log.debug(peripheralList);
  for ( var index in peripheralList ) {
    periph = peripheralList[ index ].dkModule;
    if ( periph != null ) {
      jsonreturn[ periph.id ] = {
        "id": periph.id,
        "particle-id": periph.particleId,
        "rssi": periph.rssi,
        "uptime": ( Date.now( ) - periph.connectedTime ) / 1000
      };
    }
  }
  res.contentType( 'application/json' );
  res.set( "Access-Control-Allow-Origin", "*" ); // allow access from other ports
  res.send( JSON.stringify( jsonreturn ) );
} );

var serverApp = server.listen( serverPort, function ( ) {
  log.debug( "Started server on port", serverPort );
} );

function deletePeripheral( id ) {

  // TODO: Replace with event based deletion
  //    if (!removing[id]) {
  //        removing[id] = true;
  //    } else {
  //        return;
  //    }
  noble.stopScanning( ); // Not sure if necessary, but probably doesn't hurt
  if ( peripheralList[ id ] ) {

    log.info( 'Master: Removing peripheral:', id );
    delete peripheralList[ id ].dkModule;
    //setTimeout(function() {
    delete peripheralList[ id ];
    //    delete removing[id];
    //}, 1500);
  }
  if ( !shuttingDown )
    noble.startScanning( );
}

noble.on( 'discover', function ( peripheral ) {
  if ( !peripheralList[ peripheral.id ] && settings.get( 'blacklist' ).indexOf( peripheral.id ) < 0 ) {

    noble.stopScanning( ); // turn off scanning while connecting HACK?

    log.info( 'Master: Found peripheral with ID ' + peripheral.id + ' and Name ' + peripheral.advertisement.localName );

    peripheralList[ peripheral.id ] = {
      found: true,
      dkModule: null
    };

    peripheral.connect( function ( error ) {
      peripheral.discoverServices( [ BLUZ_SERVICE_UUID ], function ( error, services ) {

        log.trace( services );

        if ( services.length > 0 ) {
          log.info( 'Peripheral a bluz' );
          var bluzMod = new BluzDKModule( peripheral, function ( ) {
            deletePeripheral( peripheral.id );
          } );

          peripheralList[ peripheral.id ].dkModule = bluzMod;
        } else {
          log.info( 'Peripheral not a Bluz' );
          peripheral.disconnect( );
        }

        startScanning( ); // connected, resume scanning
      } );

    } );
  }
} );

if ( process.platform === "win32" ) {
  var rl = require( "readline" ).createInterface( {
    input: process.stdin,
    output: process.stdout
  } );

  rl.on( "SIGINT", function ( ) {
    process.emit( "SIGINT" );
  } );
}

process.on( "SIGINT", function ( ) {
  noble.stopScanning( );
  shuttingDown = true;
  for ( var key in peripheralList ) {
    peripheralList[ key ].dkModule.peripheral.disconnect( );
    peripheralList[ key ].dkModule.client.end( );
  }
  serverApp.close( );
  //graceful shutdown
  setTimeout( process.exit, 1500 );
} );
