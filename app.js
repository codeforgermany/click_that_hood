var express = require('express'),
    lessMiddleware = require('less-middleware'),
    compression = require('compression'),
    fs = require('fs'),
    path = require('path'),
    glob = require('glob'),
    config = require('config')

var engineLightStatusEndpoint = function(req, res) {
  var response = {
    'status': 'ok',
    'updated': Math.round(Date.now() / 1000),
    'dependencies': ['MapBox'],
    'resources': []
  };

  res.send(response);
}

function startApp() {
  var app = express();

  app.use(compression());

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
    res.sendFile(__dirname + '/public/index.html');
  });

  app.get('/', function(req, res) {
    // redirect old-style /?location=XYZ and /?city=XYZ urls to new-style /XYZ
    if (req.query.location) {
      res.redirect(301, req.query.location);
    } else if (req.query.city) {
      res.redirect(301, req.query.city);
    } else {
      res.sendFile(__dirname + '/public/index.html');
    }
  });

  app.use(express.static(__dirname + '/public'));

  app.listen(config.port, null, null, function() {
    console.log('The app is running: http://' + config.app_host_port);
  });
}

function normalizeCountryName(str) {
  if (str.substr(0, 4) == 'The ') {
    str = str.substr(4);
  }

  return str;
}

function getFeatureCoords(data) {
  if (data[0][0]) {
    return getFeatureCoords(data[0])
  } else {
    return [data[0], data[1]]
  }
}

function checkFeature(locationName, feature, names, flags) {
  var name = feature.properties.name

  if (!name) {
    console.log('------------------------------------------------------')
    console.log('Neighbourhood name missing in ' + locationName + '…')
    console.log('Make sure the column with neighbourhood names is actually called “name.”')
    process.exit(1)
  }

  if (name.match(/[a-z]/)) {
    flags.someLowercase = true
  }

  if (name.match(/[A-Z]/)) {
    flags.someUppercase = true
  }

  if (names[name]) {
    var oldId = names[name].id
    var newId = feature.properties.cartodb_id

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

    flags.errorOccurred = true
  }

  names[name] = { id: feature.properties.cartodb_id }
}

function isTemplateFile(file) {
  // TODO: find a less obscure way to detect this file
  return file.indexOf(path.sep + '_') !== -1
}

function readMetadataFile(file, metadata, countryNames) {
  var locationName = path.basename(file, '.metadata.json');

  console.log('Loading data: ' + locationName)

  // Flag error and exit if metadata is not found
  if (!fs.existsSync(file)) {
    console.error('Metadata file not found for \'' + locationName +
                  '\'. Aborting server start.');
    process.exit(1);
  }

  metadata[locationName] = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Combine a list of country names.
  var countryName = metadata[locationName].countryName;

  if (!countryName && !metadata[locationName].stateName) {
    countryName = 'The World';
  }

  if (countryName && countryNames.indexOf(countryName) === -1) {
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

  // Verify that names exist and that they don't repeat
  var names = []
  var flags = {
    someLowercase: false,
    someUppercase: false,
    errorOccurred: false
  }

  for (var i in geoJsonData.features) {
    checkFeature(locationName, geoJsonData.features[i], names, flags)
  }

  if (flags.errorOccurred) {
    process.exit(1)
  }

  if (!flags.someLowercase && flags.someUppercase) {
    console.log('------------------------------------------------------')
    console.log('All neighbourhood names for ' + locationName + ' are uppercase…')
    console.log(' ')
    console.log('Try this SQL query to fix:')
    console.log('UPDATE ' + locationName + ' SET name=initcap(lower(name));')
    process.exit(1)
  }

  var latLon = getFeatureCoords(geoJsonData.features[0].geometry.coordinates)

  if (latLon[0] === null || latLon[1] === null) {
    console.log('------------------------------------------------------')
    console.log('WARNING: Cannot obtain average coordinates for ' + locationName + '…')
  }

  metadata[locationName].sampleLatLon = latLon
}

console.log('Initializing…')

// Write combined metadata file from individual location metadata files
glob('public/data/**/*.metadata.json', function(err, files) {
  var metadata = {};
  var countryNames = ['U.S.'];
  var totalNumFilesToUpload = 0;
  var numFilesUploaded = 0;

  for (var i in files) {
    if (!isTemplateFile(files[i])) {
      readMetadataFile(files[i], metadata, countryNames)
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

  console.log()

  startApp();
});
