// Memory Map

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('starter', ['ionic', 'ngCordova'])

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider.state('map', {
    url: '/',
    templateUrl: 'templates/map.html',
    controller: 'MapCtrl'
  });

  $urlRouterProvider.otherwise("/");
})

// Map Controller
.controller('MapCtrl', function($scope, $state, $cordovaGeolocation) {

}) // End Map Controller

// Connectivity Monitor Factory
.factory('ConnectivityMonitor', function($rootScope, $cordovaNetwork) {
  return {
    isOnline: function() {
      if(ionic.Platform.isWebView()) {
        return $cordovaNetwork.isOnline();
      } else {
        return navigator.onLine;
      }
    },

    isOffline: function() {
      if(ionic.Platform.isWebView()) {
        return !$cordovaNetwork.isOnline();
      } else {
        return !navigator.onLine;
      }
    } 
  }
})

// Google Maps Factory
.factory('GoogleMaps', function($cordovaGeolocation, $ionicLoading, $rootScope, $cordovaNetwork, Markers, ConnectivityMonitor) {
  var markerCache = []
  var apiKey = false;
  var map = null;

  function initMap() {
    var options = {timeout: 10000, enableHighAccuracy: true};

    $cordovaGeolocation.getCurrentPosition(options).then(function(position) {
      var latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);

      var mapOptions = {
        center: latLng,
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };

      map = new google.maps.Map(document.getElementById("map"), mapOptions);

      // Wait until the map is loaded
      google.maps.event.addListenerOnce(map, 'idle', function() {
        // Load markers
        loadMarkers();

        // Reload the markers every time the map moves
        google.maps.event.addListener(map, 'dragend', function() {
          console.log("moved the map");
          loadMarkers();
        });
        // Reload markers upon zoom
        google.maps.event.addListener(map, 'zoom_changed', function() {
          console.log("changed zoom");
          loadMarkers();
        });

        enableMap();
      });
    }, function(error) {
      console.log("Could not get location");

      // Load markers
      loadMarkers();
    });
  }

  function enableMap() {
    $ionicLoading.hide();
  }

  function disableMap() {
    $ionicLoading.show({
      template: 'You are not connected to the internet.'
    });
  }

  function loadGoogleMaps() {
    $ionicLoading.show({
      template: 'Loading Google Maps'
    });

    // This function will be loaded after the SDK has been loaded
    window.mapInit = function() {
      initMap();
    };

    // Script element to insert in the page
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.id = "googleMaps";

    if(apiKey) {
      script.src = 'http://maps.google.com/maps/api/js?key=' + apiKey 
+ '&sensor=true&callback=mapInit';
    } else {
      script.src = 'http://maps.google.com/maps/api/js?sensor=true&callback=mapInit';
    }

    document.body.appendChild(script);

  }

  function checkLoaded() {
    if (typeof google == "undefined" || typeof google.maps == "undefined") {
      loadGoogleMaps();
    } else {
      enableMap();
    }
  }

  function loadMarkers() {
    var center = map.getCenter();
    var bounds = map.getBounds();
    var zoom = map.getZoom();

    // Convert objects returned by Google to be more readable
    var centerNorm = {
      lat: center.lat(),
      lng: center.lng()
    };
    var boundsNorm = {
      northeast: {
        lat: bounds.getNorthEast().lat(),
        lng: bounds.getNorthEast().lng()
      },
      southwest: {
        lat: bounds.getSouthWest().lat(),
        lng: bounds.getSouthWest().lng()
      }
    };

    var boundingRadius = getBoundingRadius(centerNorm, boundsNorm);

    var params = {
      "center": centerNorm,
      "bounds": boundsNorm,
      "zoom": zoom,
      "boundingRadius": boundingRadius
    };

    var markers = Markers.getMarkers(params).then(function(markers) {
      console.log("Markers: ", markers);

      var records = markers.data.markers;
      console.log("Num records: ", records.length);

      for (var i = 0; i < records.length; i++) {
        var record = records[i];

        // Check if the marker has already been added
        if (!markerExists(record.lat, record.lng)) {
          var markerPosition = new google.maps.LatLng(record.lat, record.lng);

          // Add the marker to the map
          var marker = new google.maps.Marker({
            map: map,
            animation: google.maps.Animation.DROP,
            position: markerPosition
          });

          // Add the marker to the markerCache so we won't add it again
          var markerData = {
            lat: record.lat,
            lng: record.lng,
            marker: marker
          };
          markerCache.push(markerData);

          var infoWindowContent = "<h4>" + record.name + "</h4>";
          addInfoWindow(marker, infoWindowContent, record);
        }
      }

    }) 
  }

  function markerExists(lat, lng) {
    var exists = false;
    var cache = markerCache;
    for (var i = 0; i < cache.length; i++) {
      if (cache[i].lat === lat && cache[i].lng === lng) {
        exists = true;
      }
    }
    return exists;
  }

  function getBoundingRadius(center, bounds) {
    return getDistanceBetweenPoints(center, bounds.northeast, 'miles');
  }

  function getDistanceBetweenPoints(point1, point2, units) {
    var earthRadius = {
      miles: 3958.8,
      km: 6371
    };

    var radius = earthRadius[units || 'miles'];
    var lat1 = point1.lat;
    var lng1 = point1.lng;
    var lat2 = point2.lat;
    var lng2 = point2.lng;

    var latDifference = toRad((lat2 - lat1));
    var lngDifference = toRad((lng2 - lng1));

    var area = Math.sin(latDifference / 2) * Math.sin(latDifference / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(lngDifference / 2) * Math.sin(lngDifference / 2);

    var c = 2 * Math.atan2(Math.sqrt(area), Math.sqrt(1 - area));
    var distance = radius * c;

    return distance;
  }

  function toRad(x) {
    return x * Math.PI / 180;
  }

  function addInfoWindow(marker, message, record) {
    var infoWindow = new google.maps.InfoWindow({
      content: message
    });

    google.maps.event.addListener(marker, 'click', function() {
      infoWindow.open(map, marker);
    });
  }

  function addConnectivityListeners() {

    if (ionic.Platform.isWebView()) {
      // Check if the map is loaded when the user comes online
      $rootScope.$on('$cordovaNetwork:online', function(event, networkState) {
        checkLoaded();
      });
      // Disable the map when user goes offline
      $rootScope.$on('$cordovaNetwork:offline', function(event, networkState) {
        disableMap();
      });
    } else {
      window.addEventListener("online", function(e) {
        checkLoaded();
      }, false);
      window.addEventListener("offline", function(e) {
        disableMap();
      }, false);
    }
  }

  return {
    init: function(key) {
      if (typeof key != "undefined") {
        apiKey = key;
      }

      if (typeof google == "undefined" || typeof google.maps == "undefined") {
        console.warn("Google Maps SDK needs to be loaded");

        disableMap();
        if (ConnectivityMonitor.isOnline()) {
          loadGoogleMaps();
        }
      } else {
        if (ConnectivityMonitor.isOnline()) {
          initMap();
          enableMap();
        } else {
          disableMap();
        }
      }
      addConnectivityListeners();
    }
  }
}) // End Google Maps factory

// Markers Factory
.factory('Markers', function($http) {
  var markers = [];

  return {
    // Return all available markers
    getMarkers: function(params) {
      return $http.get("http://aubryandjoe.com/memory-map/markers.php", {params:params}).then(function(response) {
        markers = response;
        return markers;
      });

    },
    // Return single marker with id
    getMarker: function(id) {

    }
  }
}) // End Markers Factory

.run(function($ionicPlatform, GoogleMaps) {
  $ionicPlatform.ready(function() {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

      // Don't remove this line unless you know what you are doing. It stops the viewport
      // from snapping when text inputs are focused. Ionic handles this internally for
      // a much nicer keyboard experience.
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }

    GoogleMaps.init("AIzaSyAqkWnEM3FASXWUmTrkN-ATaJxVcqSWmfg");
  });
})
