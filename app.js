var express = require('express'),
    lessMiddleware = require('less-middleware'),
    fs = require('fs'),
    fsTools = require('fs-tools'),
    config = require('config');

var startApp = function() {
  var app = express();

  app.use(express.compress());

  app.use(lessMiddleware({
    src: __dirname + '/public',
    compress: (process.env.NODE_ENV == 'production'),
    once: (process.env.NODE_ENV == 'production')
  }));

  // Redirect to environment-appropriate domain, if necessary
  app.all('*', function(req, res, next) {
    if (config.app_host_port != req.headers.host) {
      var redirectUrl = 'http://' + config.app_host_port + req.url;
      console.log('Redirecting to ' + redirectUrl + '...');
      res.redirect(301, redirectUrl);
    } else {
      next('route');
    }
  });

  app.use(express.static(__dirname + '/public'));

  var port = process.env.PORT || 8000;
  app.listen(port, null, null, function() {
    console.log('Listening on port ' + port);
  });
}

// Write combined metadata file from individual location metadata files
fsTools.findSorted('public/data', /[^.]+\.metadata.json/, function(err, files) {
  var metadata = {};

  for (index in files) {
    var metadataFilePath = files[index];
    var locationName = metadataFilePath.match(/([^\/.]+)\.metadata.json/)[1];

    // Exclude template file
    if (locationName != "_TEMPLATE") {
      // Flag error and exit if metadata is not found
      if (!fs.existsSync(metadataFilePath)) {
        console.error("Metadata file not found for '" + locationName + 
            "'. Aborting server start.");
        process.exit(1);
      }
      
      metadata[locationName] = 
          JSON.parse(fs.readFileSync(metadataFilePath, 'utf8'));

      // Parse GeoJSON file, find the first available latitude/longitude,
      // and add them to the metadata.

      //geoJsonFilePath = 'public/data/' + locationName + '.geojson';
      geoJsonFilePath = 'public/data/' + metadata[locationName].dataFile;
      if (!fs.existsSync(geoJsonFilePath)) {
        console.error("GeoJSON file not found for '" + locationName + 
            "'. Aborting server start.");
        process.exit(1);
      }

      var geoJsonData = JSON.parse(fs.readFileSync(geoJsonFilePath, 'utf8'));

      var latLon = geoJsonData.features[0].geometry.coordinates[0][0];

      if (latLon[0][0]) {
        var lat = latLon[0][0];
        var lon = latLon[0][1];
      } else {
        var lat = latLon[0];
        var lon = latLon[1];
      }

      metadata[locationName].sampleLatLon = [lat, lon];
    }
  }

  var metadataFileContents = 
      "//\n// This file is AUTO-GENERATED each time the " +
      "application is restarted.\n//\n\nvar CITY_DATA = " + 
      JSON.stringify(metadata) + ";";
  fs.writeFileSync("public/js/data.js", metadataFileContents);

  startApp();    
});