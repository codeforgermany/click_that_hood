var express = require('express'),
    lessMiddleware = require('less-middleware'),
    fs = require('fs'),
    path = require('path'),
    fsTools = require('fs-tools'),
    config = require('config')

var engineLightStatusEndpoint = function(req, res) {

  var response = {
    'status': 'ok',
    'updated': Math.round( Date.now() / 1000 ),
    'dependencies': [ 'MapBox' ],
    'resources': []
  };

  res.send(response);

}

var startApp = function() {
  var app = express();

  app.use(express.compress());

  app.use(lessMiddleware(__dirname + '/public', {
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

  // Engine-light endpoint
  app.get('/.well-known/status', engineLightStatusEndpoint);

  app.get('/:location', function(req, res) {
    res.sendfile(__dirname + '/public/index.html');
  });

  app.get('/', function(req, res) {
    // redirect old-style /?location=XYZ and /?city=XYZ urls to new-style /XYZ
    if (req.query.location) {
      res.redirect(301, req.query.location);
    } else if (req.query.city) {
      res.redirect(301, req.query.city);
    } else {
      res.sendfile(__dirname + '/public/index.html');
    }
  });

  app.use(express.static(__dirname + '/public'));

  app.listen(config.port, null, null, function() {
    console.log('Listening on port ' + config.port);
  });
}

function normalizeCountryName(str) {
  if (str.substr(0, 4) == 'The ') {
    str = str.substr(4);
  }

  return str;
}

function getSampleLatLon(shapes) {
  if (shapes[0] && shapes[0][0] && shapes[0][0][0] && shapes[0][0][0][0]) {
    return [shapes[0][0][0][0], shapes[0][0][0][1]]
  } else if (shapes[0] && shapes[0][0] && shapes[0][0][0]) {
    return [shapes[0][0][0], shapes[0][0][1]]
  } else if (shapes[0] && shapes[0][0]) {
    return [shapes[0][0], shapes[0][1]]
  } else {
    return [shapes[0], shapes[1]]
  }
}

console.log('Initializing…')

// Write combined metadata file from individual location metadata files
fsTools.findSorted('public/data', /[^.]+\.metadata.json/, function(err, files) {

  var metadata = {};

  var countryNames = ['U.S.'];

  var totalNumFilesToUpload = 0;
  var numFilesUploaded = 0;
  for (var index in files) {
    var metadataFilePath = files[index];
    var locationName = path.basename(metadataFilePath, '.metadata.json');

    // Exclude template file
    if (metadataFilePath.indexOf('/_') == -1) {
      // Flag error and exit if metadata is not found
      if (!fs.existsSync(metadataFilePath)) {
        console.error('Metadata file not found for \'' + locationName +
                      '\'. Aborting server start.');
        process.exit(1);
      }

      metadata[locationName] =
        JSON.parse(fs.readFileSync(metadataFilePath, 'utf8'));

      // Combine a list of country names.
      var countryName = metadata[locationName].countryName;
      if (!countryName && !metadata[locationName].stateName) {
        countryName = 'The World';
      }
      if (countryName && countryNames.indexOf(countryName) == -1) {
        countryNames.push(countryName);
      }


      // Parse GeoJSON file, find the first available latitude/longitude,
      // and add them to the metadata.

      var geoJsonFilePath = 'public/data/' + locationName + '.geojson';
      if (!fs.existsSync(geoJsonFilePath)) {
        console.error('GeoJSON file not found for \'' + locationName +
                      '\'. Aborting server start.');
        process.exit(1);
      }

      var geoJsonData = JSON.parse(fs.readFileSync(geoJsonFilePath, 'utf8'));

      // Verify whether names exist, and also whether they don’t repeat
      var names = []
      var someLowercase = false
      var someUppercase = false
      var someErrors = false

      for (var i in geoJsonData.features) {
        var data = geoJsonData.features[i]
        var name = data.properties.name

        if (!name) {
          console.log('------------------------------------------------------')
          console.log('Name missing in ' + locationName + '…')
          console.log('Make sure the column with neighbourhood names is actually called “name.”')
          process.exit(1)
        }

        if (name.match(/[a-z]/)) {
          someLowercase = true
        }
        if (name.match(/[A-Z]/)) {
          someUppercase = true
        }

        if (names[name]) {
          var oldId = names[name].id
          var newId = data.properties.cartodb_id

          if (!oldId && !newId) {
            oldId = 1
            newId = 2
          }

          console.log('------------------------------------------------------')
          console.log('Name repetition (' + name + ') in ' + locationName + '…')
          console.log(' ')
          console.log('This is usually when a neighbourhood has a few disconnected/non overlapping polygons.')
          console.log('These are two SQL commands that might unify two polygons into one.')
          console.log(' ')
          console.log('UPDATE ' + locationName + ' SET the_geom = ST_Union((SELECT the_geom FROM ' + locationName + ' WHERE cartodb_id = ' + oldId + '), (SELECT the_geom FROM ' + locationName + ' WHERE cartodb_id = ' + newId + ')) WHERE cartodb_id = ' + oldId + ';')
          console.log('DELETE FROM ' + locationName + ' WHERE cartodb_id = ' + newId + ';')
          someErrors = true
        }

        names[name] = { id: data.properties.cartodb_id }
      }

      if (someErrors) {
        process.exit(1)
      }

      if (!someLowercase && someUppercase) {
        console.log('------------------------------------------------------')
        console.log('All uppercase names for ' + locationName + '…')
        console.log(' ')
        console.log('Try this SQL query to fix:')
        console.log('UPDATE ' + locationName + ' SET name=initcap(lower(name));')
        process.exit(1)
      }

      var latLon = geoJsonData.features[0].geometry.coordinates;
      metadata[locationName].sampleLatLon = getSampleLatLon(latLon);

      if ((metadata[locationName].sampleLatLon[0] == null) || (metadata[locationName].sampleLatLon[1] == null)) {
        console.log('------------------------------------------------------')
        console.log('WARNING: Unknown average location for ' + locationName + '…')
      }
    }
  }

  countryNames.sort(function(a, b) {
    return (normalizeCountryName(a) > normalizeCountryName(b)) ? 1 : -1;
  });

  var metadataFileContents =
    '//\n// This file is AUTO-GENERATED each time the ' +
    'application is restarted.\n//\n\n' +
    'var CITY_DATA = ' + JSON.stringify(metadata) + ';\n' +
    'var COUNTRY_NAMES = ' + JSON.stringify(countryNames) + ';\n';
  fs.writeFileSync('public/js/data.js', metadataFileContents);

  console.log('Done!')

  startApp();
});
