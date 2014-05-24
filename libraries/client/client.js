/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Load superagent-hawk
require('superagent-hawk')(require('superagent'));

var request     = require('superagent-promise');
var debug       = require('debug')('taskcluster-client');
var _           = require('lodash');
var Promise     = require('promise');

// Default options stored globally for convenience
var _defaultOptions = {};

/**
 * Create a client class from a JSON reference.
 *
 * Returns a Client class which can be initialized with following options:
 * options:
 * {
 *   credentials: {
 *     clientId:     '...',        // ClientId
 *     accessToken:  '...',        // AccessToken for clientId
 *     delegating: true || false,  // Is delegating authentication?
 *     scopes:     ['scopes', ...] // Scopes to authorize with
 *   }
 *   baseUrl:    'http://.../v1' // API baseUrl, default is taken from reference
 * }
 */
exports.createClient = function(reference) {
  // Client class constructor
  var Client = function(options) {
    this._options = _.defaults(options || {}, {
      baseUrl:  reference.baseUrl
    }, _defaultOptions);
  };
  // For each function entry create a method on the Client class
  reference.entries.filter(function(entry) {
    return entry.type === 'function';
  }).forEach(function(entry) {
    // Get number of arguments
    var nb_args = entry.args.length;
    if (entry.input) {
      nb_args += 1;
    }
    // Create method on prototype
    Client.prototype[entry.name] = function() {
      debug("Calling: " + entry.name);
      // Convert arguments to actual array
      var args = Array.prototype.slice.call(arguments);
      // Validate number of arguments
      if (args.length != nb_args) {
        throw new Error("Function " + entry.name + " takes " + nb_args +
                        "arguments, but was given " + args.length +
                        " arguments");
      }
      // Substitute parameters into route
      var endpoint = entry.route;
      entry.args.forEach(function(arg) {
        endpoint = endpoint.replace('<' + arg + '>', args.shift() || '');
      });
      // Create request
      var req = request[entry.method](reference.baseUrl + endpoint);
      // Add payload if one is given
      if (entry.input) {
        req.send(args.pop());
      }
      // Authenticate, if credentials are provided
      if (this._options.credentials) {
        var extra = {};
        // if delegating scopes, provide the scopes set to delegate
        if (this._options.credentials.delegating) {
          assert(this._options.credentials.scopes,
                 "Can't delegate without scopes to delegate");
          extra.ext = {
            delegating: true,
            scopes:     this._options.credentials.scopes;
          };
        }
        // Write hawk authentication header
        req.hawk({
          id:         this._options.credentials.clientId,
          key:        this._options.credentials.accessToken,
          algorithm:  'sha256'
        }, extra);
      }
      // Send request and handle response
      return req.end().then(function(res) {
        if (!res.ok) {
          debug("Error calling: " + entry.name, res.body);
          throw new Error(res.body);
        }
        debug("Success calling: " + entry.name);
        return res.body;
      });
    };
  });

  // Return client class
  return Client;
};


// Load data from apis.json
(function() {
  var fs   = require('fs');
  var path = require('path');
  var data = fs.readFileSync(path.join(__dirname, 'apis.json'), {
    encoding: 'utf-8'
  });
  var apis = JSON.parse(data);

  // Instantiate clients
  _.forIn(apis, function(api, name) {
    exports[name] = exports.createClient(api.reference);
  });
})();


/**
 * Update default configuration
 *
 * Example: `Client.config({credentials: {...}});`
 */
exports.config = function(options) {
  _defaultOptions = _.defaults(options, _defaultOptions);
};