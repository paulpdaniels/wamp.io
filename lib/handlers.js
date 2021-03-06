
/*!
 * wamp.io: a node.js WAMP™ server
 * Copyright (c) 2012 Nico Kaiser <nico@kaiser.me>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var protocol = require('./protocol')
  , prefixes = require('./prefixes')
  , debug = require('debug')('wamp-server');

var handlers = {};

/**
 * Prefix Message
 *
 * @param {wsio.Connection} client
 * @param {Array} args prefix, uri
 */

handlers[protocol.TYPE_ID_PREFIX] = function(client, args) {
  prefix = args.shift();
  uri = args.shift();
  client.prefixes[prefix] = uri;
};

/**
 * Call Message
 *
 * @param {wsio.Connection} client
 * @param {Array} args callId, procUri, ...
 */

handlers[protocol.TYPE_ID_CALL] = function(client, args) {
  callId = args.shift();
  prefixes.resolveOrPass(procUri = args.shift());
  args = args || [];

  // Callback function
  cb = function(err, result) {
    var msg;
    if (err) {
      msg = [protocol.TYPE_ID_CALL_ERROR, callId, 'http://autobahn.tavendo.de/error#generic', err.toString()];
    } else {
      msg = [protocol.TYPE_ID_CALL_RESULT, callId, result];
    }
    client.send(JSON.stringify(msg));
  };

  this.emit('call', procUri, args, cb);
};

/**
 * Subscribe Message
 *
 * @param {wsio.Connection} client
 * @param {Array} args topicUri
 */

handlers[protocol.TYPE_ID_SUBSCRIBE] = function(client, args) {
  topicUri = prefixes.resolveOrPass(args.shift());
  client.topics[topicUri] = true;
  if (typeof this.topics[topicUri] === 'undefined') {
    this.topics[topicUri] = {};
  }
  this.topics[topicUri][client.id] = true;
  debug('subscribed client %s for topic: %s', client.id, topicUri);
  this.emit('subscribed', client.id, topicUri, args);
};

/**
 * Unsubscribe Message
 *
 * @param {wsio.Connection} client
 * @param {Array} args topicUri
 */

handlers[protocol.TYPE_ID_UNSUBSCRIBE] = function(client, args) {
  topicUri = prefixes.resolveOrPass(args.shift());
  if (topicUri) {
    delete client.topics[topicUri];
    delete this.topics[topicUri][client.id];
    debug('unsubscribed client %s from topic: %s', client.id, topicUri);
  } else {
    for (var topic in Object.keys(client.topics)) {
      delete this.topics[topic][client.id];
    }
    client.topics = {};
    debug('unsubscribed client %s from all topics', client.id);
    this.emit('unsubscribed', client.id, topicUri, args);
  }
};

/**
 * Publish Message
 *
 * @param {wsio.Connection} client
 * @param {Array} args topicUri, event, excludeMe
 */

handlers[protocol.TYPE_ID_PUBLISH] = function(client, args) {
  var topicUri = prefixes.resolveOrPass(args.shift());
  var event = args.shift();
  var exclude = args.shift();

  if (typeof exclude !== 'undefined') {
      if (exclude && !Array.isArray(exclude))
        exclude = [client.id];
      else if (!exclude)
        exclude = [];
  } else {
      exclude = [client.id];
  }

  var eligible = args.shift();

  this.publish(topicUri, event, exclude, eligible);
  debug('published event %s for topic %s', event, topicUri);
  this.emit('publish', client.id, event, topicUri, args);
};

module.exports = handlers;
