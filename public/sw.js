(function () {
  "use strict";

  var cacheNameStatic = 'hralgolia-v2.1';
  var currentCacheNames = [ cacheNameStatic ];
  var urls = [
    '/',
    '/dashboard',
    '/style.css',
    '/app.js',
    '//fonts.googleapis.com/icon?family=Material+Icons',
    '//code.jquery.com/jquery-3.1.1.min.js',
    '//cdnjs.cloudflare.com/ajax/libs/materialize/0.97.8/js/materialize.min.js',
    '//cdn.jsdelivr.net/algoliasearch/3/algoliasearchLite.min.js',
    '//cdn.jsdelivr.net/algoliasearch/3/algoliasearch.min.js',
    '//use.fontawesome.com/61086dca98.js',
    '//cdnjs.cloudflare.com/ajax/libs/materialize/0.97.8/css/materialize.min.css',
    '//cdn.fontawesome.com/js/stats.js',
    '//use.fontawesome.com/61086dca98.css',
    '//cdnjs.cloudflare.com/ajax/libs/materialize/0.97.8/fonts/roboto/Roboto-Regular.woff2',
    '//cdnjs.cloudflare.com/ajax/libs/materialize/0.97.8/fonts/roboto/Roboto-Medium.woff2',
    '//cdnjs.cloudflare.com/ajax/libs/materialize/0.97.8/fonts/roboto/Roboto-Light.woff2',
    '//use.fontawesome.com/releases/v4.7.0/css/font-awesome-css.min.css',
    '//use.fontawesome.com/releases/v4.7.0/fonts/fontawesome-webfont.woff2',
    '//cdn.jsdelivr.net/pouchdb/6.0.7/pouchdb.min.js'
  ];

  // A new ServiceWorker has been registered
  self.addEventListener("install", function (event) {
    event.waitUntil(
      caches.delete(cacheNameStatic).then(function() {
        return caches.open(cacheNameStatic);
      }).then(function (cache) {
        return cache.addAll(urls);
      }).catch(function(e) {
        console.error(e);
      })
    );
  });


  // A new ServiceWorker is now active
  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches.keys()
        .then(function (cacheNames) {
          return Promise.all(
            cacheNames.map(function (cacheName) {
              if (currentCacheNames.indexOf(cacheName) === -1) {
                return caches.delete(cacheName);
              }
            })
          );
        })
    );
  });


  // The page has made a request
  self.addEventListener("fetch", function (event) {
    var requestURL = new URL(event.request.url);
    event.respondWith(
      caches.match(event.request)
        .then(function (response) {

          if (response) {
            return response;
          }

          var fetchRequest = event.request.clone();

          return fetch(fetchRequest).then(
            function (response) {

              var shouldCache = false;
              if (urls.indexOf(requestURL.href) > -1 && response.status === 200) {
                shouldCache = cacheNameStatic;
              }

              if (shouldCache) {
                var responseToCache = response.clone();

                caches.open(shouldCache)
                  .then(function (cache) {
                    var cacheRequest = event.request.clone();
                    cache.put(cacheRequest, responseToCache);
                  });
              }

              return response;
            }
          );
        })
    );
  });


})();
