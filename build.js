var fs = require("fs"),
  path = require("path"),
  glob = require("glob");

function normalizeCountryName(str) {
  if (str.substr(0, 4) == "The ") {
    str = str.substr(4);
  }

  return str;
}

function getFeatureCoords(data) {
  if (data[0][0]) {
    return getFeatureCoords(data[0]);
  } else {
    return [data[0], data[1]];
  }
}

function checkFeature(locationName, feature, names, flags) {
  var name = feature.properties.name;

  if (!name) {
    console.log("------------------------------------------------------");
    console.log("Neighbourhood name missing in " + locationName + "…");
    console.log(
      "Make sure the column with neighbourhood names is actually called “name.”"
    );
    process.exit(1);
  }

  if (name.match(/[a-z]/)) {
    flags.someLowercase = true;
  }

  if (name.match(/[A-Z]/)) {
    flags.someUppercase = true;
  }

  if (names[name]) {
    var oldId = names[name].id;
    var newId = feature.properties.cartodb_id;

    if (!oldId && !newId) {
      oldId = 1;
      newId = 2;
    }

    console.log("------------------------------------------------------");
    console.log("Name repetition (" + name + ") in " + locationName + "…");
    console.log(" ");
    console.log(
      "This is usually when a neighbourhood has a few disconnected/non overlapping polygons."
    );
    console.log(
      "These are two SQL commands that might unify two polygons into one."
    );
    console.log(" ");
    console.log(
      "UPDATE " +
        locationName +
        " SET the_geom = ST_Union((SELECT the_geom FROM " +
        locationName +
        " WHERE cartodb_id = " +
        oldId +
        "), (SELECT the_geom FROM " +
        locationName +
        " WHERE cartodb_id = " +
        newId +
        ")) WHERE cartodb_id = " +
        oldId +
        ";"
    );
    console.log(
      "DELETE FROM " + locationName + " WHERE cartodb_id = " + newId + ";"
    );

    flags.errorOccurred = true;
  }

  names[name] = { id: feature.properties.cartodb_id };
}

function isTemplateFile(file) {
  // TODO: find a less obscure way to detect this file
  return file.indexOf(path.sep + "_") !== -1;
}

function readMetadataFile(file, metadata, countryNames) {
  var locationName = path.basename(file, ".metadata.json");

  console.log("Reading data:", locationName);

  // Flag error and exit if metadata is not found
  if (!fs.existsSync(file)) {
    console.error(
      "Metadata file not found for '" +
        locationName +
        "'. Aborting server start."
    );
    process.exit(1);
  }

  metadata[locationName] = JSON.parse(fs.readFileSync(file, "utf8"));

  // Combine a list of country names.
  var countryName = metadata[locationName].countryName;

  if (!countryName && !metadata[locationName].stateName) {
    countryName = "The World";
  }

  if (countryName && countryNames.indexOf(countryName) === -1) {
    countryNames.push(countryName);
  }

  // Parse GeoJSON file, find the first available latitude/longitude,
  // and add them to the metadata.
  var geoJsonFilePath = "public/data/" + locationName + ".geojson";

  if (!fs.existsSync(geoJsonFilePath)) {
    console.error(
      "GeoJSON file not found for '" +
        locationName +
        "'. Aborting server start."
    );
    process.exit(1);
  }

  var geoJsonData = JSON.parse(fs.readFileSync(geoJsonFilePath, "utf8"));

  // Verify that names exist and that they don't repeat
  var names = [];
  var flags = {
    someLowercase: false,
    someUppercase: false,
    errorOccurred: false,
  };

  for (var i in geoJsonData.features) {
    checkFeature(locationName, geoJsonData.features[i], names, flags);
  }

  if (flags.errorOccurred) {
    process.exit(1);
  }

  if (!flags.someLowercase && flags.someUppercase) {
    console.log("------------------------------------------------------");
    console.log(
      "All neighbourhood names for " + locationName + " are uppercase…"
    );
    console.log(" ");
    console.log("Try this SQL query to fix:");
    console.log("UPDATE " + locationName + " SET name=initcap(lower(name));");
    process.exit(1);
  }

  var latLon = getFeatureCoords(geoJsonData.features[0].geometry.coordinates);

  if (latLon[0] === null || latLon[1] === null) {
    console.log("------------------------------------------------------");
    console.log(
      "WARNING: Cannot obtain average coordinates for " + locationName + "…"
    );
  }

  metadata[locationName].sampleLatLon = latLon;
}

//
// Build a single metadata file
//
glob("public/data/**/*.metadata.json", function (err, files) {
  var metadata = {};
  var countryNames = ["U.S."];
  var totalNumFilesToUpload = 0;
  var numFilesUploaded = 0;

  for (var i in files) {
    if (!isTemplateFile(files[i])) {
      readMetadataFile(files[i], metadata, countryNames);
    }
  }

  countryNames.sort(function (a, b) {
    return normalizeCountryName(a) > normalizeCountryName(b) ? 1 : -1;
  });

  var metadataFileContents =
    "//\n// This file is AUTO-GENERATED each time by the build system.\n//\n\n" +
    "var CITY_DATA = " +
    JSON.stringify(metadata) +
    ";\n" +
    "var COUNTRY_NAMES = " +
    JSON.stringify(countryNames) +
    ";\n";

  console.log();
  console.log("Writing file: public/js/data.js");

  fs.writeFileSync("public/js/data.js", metadataFileContents);
});
