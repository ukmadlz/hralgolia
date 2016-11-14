'use strict';

// Load ENV
require('dotenv').load({ silent: true });

// Libs
const Cfenv = require('cfenv');
const Hapi = require('hapi');
const Boom = require('boom');
const Algolia = require('algoliasearch');
const GoogleContacts = require('google-contacts').GoogleContacts;
const Url = require('url');
const Gravatar = require('gravatar');
const _ = require('lodash');

// Settings
const appEnv = Cfenv.getAppEnv();

// Create a server with a host and port
const server = new Hapi.Server();
server.connection({
  port: appEnv.port,
  host: appEnv.bind
});

// Register plugins and proceed
const options = {
    ops: {
        interval: 1000
    },
    reporters: {
        myConsoleReporter: [{
            module: 'good-squeeze',
            name: 'Squeeze',
            args: [{
              log: '*',
              response: '*',
              error: '*'
            }]
        }, {
            module: 'good-console'
        }, 'stdout'],
    }
};
server.register([
  require('hapi-auth-cookie'),
  require('hapi-context-credentials'),
  require('bell'),
  require('vision'),
  {
    register: require('good'),
    options
  }
],
function(err) {

  // Error Dump
  if (err) {
    return console.error(err);
  }

  // Register a template engine
  server.views({
    engines: { ejs: require('ejs') },
    relativeTo: __dirname,
    path: 'templates'
  });

  //Setup the session strategy
  server.auth.strategy('session', 'cookie', {
    password: process.env.SECRETSQUIRREL, //Use something more secure in production
    redirectTo: '/auth/google', //If there is no session, redirect here
    isSecure: process.env.SSL //Should be set to true (which is the default) in production
  });

  //Setup the social Twitter login strategy
  server.auth.strategy('google', 'bell', {
    provider: 'google',
    password: process.env.SECRETSQUIRREL, //Use something more secure in production
    clientId: process.env.GOOGLECLIENTID,
    clientSecret: process.env.GOOGLECLIENTSECRET,
    isSecure: process.env.SSL, //Should be set to true (which is the default) in production
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/contacts.readonly'
    ]
  });

  //Setup the routes (this could be done in an own file but for the sake of simplicity isn't)
  server.route({
    method: 'GET',
    path: '/auth/google',
    config: {
      auth: 'google', //<-- use our twitter strategy and let bell take over
      handler: function(request, reply) {

        if (!request.auth.isAuthenticated) {
          return reply(Boom.unauthorized('Authentication failed: ' + request.auth.error.message));
        }

        //Just store a part of the twitter profile information in the session as an example. You could do something
        //more useful here - like loading or setting up an account (social signup).
        const profile = request.auth.credentials.profile;

        request.cookieAuth.set({
          id: profile.id,
          displayName: profile.displayName,
          image: profile.raw.picture,
          token: request.auth.credentials.token,
        });

        buildAndSaveContacts({
          auth: {
            credentials: {
              id: profile.id,
              token: request.auth.credentials.token,
            }
          }
        });

        return reply.redirect('/dashboard');
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/',
    config: {
      handler: function(request, reply) {

        //Return a message using the information from the session
        return reply.view('pages/index', {
            title: 'HRAlgolia',
        });
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/dashboard',
    config: {
      auth: 'session', //<-- require a session for this
      handler: function(request, reply) {

        //Return a message using the information from the session
        return reply.view('pages/dashboard', {
            title: 'HRAlgolia',
            appId: process.env.ALGOLIAAPPID,
            apiKey: process.env.ALGOLIAAPIKEY,
            indexId: request.auth.credentials.id,
        });
      }
    }
  });

  server.route({
    method: 'GET',
    path: '/sync',
    config: {
      auth: 'session', //<-- require a session for this
      handler: function(request, reply) {
        buildAndSaveContacts(request, reply);
      }
    }
  });

  // Start the server
  server.start((err) => {

    if (err) {
      throw err;
    }

    console.log('Server running at:', server.info.uri);
  });
});

function buildAndSaveContacts(request, reply) {
  var c = new GoogleContacts({
    token: request.auth.credentials.token,
    thin:false,
  });

  const client = Algolia(process.env.ALGOLIAAPPID, process.env.ALGOLIAADMINKEY);
  const index = client.initIndex(request.auth.credentials.id);
  index.setSettings({
    'attributesToIndex': [
      'name',
      'email',
      'phone',
    ]
  }, function(err, content) {
    console.log(err, content);
  });

  c.getContacts(function(err, data){
    if (err) {
      console.log(err);
      reply({ syncStatus: 'Failed', message: err });
    } else {
      var contactList = [];
      _.forEach(data, function(contact) {
          var urlIdArray = Url.parse(contact.id['$t']).path.split('/');
          var contactObject = {
            objectID: urlIdArray[urlIdArray.length-1],
            name: contact.title['$t'],
            email: [],
            phone: [],
            rank: 0,
          }

          if(typeof contact['gd$organization'] != 'undefined') {
            contactObject.company = contact['gd$organization'][0]['gd$orgName']['$t'];
            if(typeof contact['gd$organization'][0]['gd$orgTitle'] != 'undefined') {
              contactObject.title = contact['gd$organization'][0]['gd$orgTitle']['$t'];
            }
          }
          _.forEach(contact['gd$email'], function(email) {
            contactObject.email.push(email.address);
            if (email.primary){
              contactObject.image = Gravatar.url(email.address);
            }
          });
          _.forEach(contact['gd$phoneNumber'], function(phone) {
            contactObject.phone.push(phone.uri);
          });
          // custom rank piece
          _.forEach(contactObject, function(value, key) {
            if(key != 'rank'){
              if(value.length) {
                contactObject.rank++;
              }
            }
          });
          contactList.push(contactObject);
          index.getObject(contactObject.objectID, function(err, content) {
            if (err) {
              index.addObject(contactObject, contactObject.objectID, function(err, content) {
                // console.log('Add objectID=' + content.objectID);
              });
            } else {
              index.saveObject(contactObject, function(err, content) {
                // console.log('Save objectID=' + content.objectID);
              });
            }
          });
      });
      if (typeof reply != 'undefined'){
        reply(contactList);
      }
    }
      //Return a message using the information from the session
  }, {
    thin: false,
    projection: 'full',
    'max-results': 10000,
  });
}
