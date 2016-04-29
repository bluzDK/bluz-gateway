'use strict';

module.exports = function ( peripheralList ) {
  
  var log = require( 'loglevel' );
  
  var settings = require( './settings.js' );
  
  if (!settings.get('serverEnabled')) {
	  // server not enabled, we'll return a dummy
	  module.close = function() {}
	  return module;
  }
  
  
  var express = require( 'express' );


  var app = express( );

  var serverPort = settings.get( 'serverPort' );

  app.use( require( 'body-parser' ).text( ) );

  app.get( '/connected-devices', function ( req, res ) {
    var jsonreturn = {};
    log.debug( 'Server Got request with headers', req.headers );
    //    log.debug(peripheralList);
    for ( var index in peripheralList ) {
      var periph = peripheralList[ index ].dkModule;
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

  app.post( '/blacklist', function ( req, res ) {
    res.contentType( 'text/plain' );
    res.set( "Access-Control-Allow-Origin", "*" ); // allow access from other ports
    var id = req.body;
    if ( !( /^[0-9A-F]{12}$/i.test( id ) ) ) {
      res.status( 400 ).send( 'Bad Format' );
      return;
    }
    var blacklist = settings.get( 'blacklist' );
    if ( blacklist.indexOf( id ) > -1 ) {
      // already blacklisted

      res.contentType( 'application/json' );
      res.status( 200 ).send( JSON.stringify( {
        'blacklist': blacklist,
        'success': false
      } ) );
    } else {
      blacklist.push( id );
      settings.set( 'blacklist', blacklist );
      settings.saveSettings( );
      if ( id in peripheralList ) {
        peripheralList[ id ].dkModule.shutDown( );
      }
      res.contentType( 'application/json' );
      res.status( 200 ).send( JSON.stringify( {
        'blacklist': blacklist,
        'success': true
      } ) );
    }
  } );

  app.get( '/blacklist', function ( req, res ) {
    res.contentType( 'application/json' );
    res.set( "Access-Control-Allow-Origin", "*" ); // allow access from other ports
    res.send( JSON.stringify( settings.get( 'blacklist' ) ) );

  } );

  app.delete( '/blacklist', function ( req, res ) {
    var id = req.body;
    if ( !( /^[0-9A-F]{12}$/i.test( id ) ) ) {
      res.status( 400 ).send( 'Bad Format' );
      return;
    }
    var blacklist = settings.get( 'blacklist' );
    var arrInd = blacklist.indexOf( id );
    if ( arrInd > -1 ) {
      // in blacklist
      blacklist.splice( arrInd, 1 );
      settings.set( 'blacklist', blacklist );
      settings.saveSettings( );

      res.contentType( 'application/json' );
      res.status( 200 ).send( JSON.stringify( {
        'blacklist': blacklist,
        'success': true
      } ) );
    } else {

      res.contentType( 'application/json' );
      res.status( 200 ).send( JSON.stringify( {
        'blacklist': blacklist,
        'success': false
      } ) );
    }
  } );

  app.get( '*.ico', function ( ) {} )

  app.use( function ( req, res, next ) {
    res.status( 404 ).send( '404 Not Found' );
  } );

  module.server = app.listen( serverPort, function ( ) {
    log.info( "Started server on port", serverPort );
  } );

  module.close = function () {
	  log.info ('Server: Shutting Down');
	  module.server.close() 
  }
  
  return module;

}
