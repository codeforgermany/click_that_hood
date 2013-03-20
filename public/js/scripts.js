/*
 * Click That ’Hood
 *
 * Front-end written (mostly) by Marcin Wichary, Code for America fellow 
 * in the year 2013.
 *
 * Note: This code is really gnarly. It’s been done under a lot of time 
 * pressure and there’s a lot of shortcut and tech debt. It might be improved
 * later if there’s time later.
 */

var COUNTRY_NAME_USA = 'U.S.';

var DEFAULT_NEIGHBORHOOD_NOUN = 'neighborhood';

var EASY_MODE_COUNT = 20;

var HIGHLIGHT_DELAY = 1500;
var NEXT_GUESS_DELAY = 1000;

var REMOVE_NEIGHBORHOOD_ANIMATE_GUESS_DELAY = 2000;

var SMALL_NEIGHBORHOOD_THRESHOLD = 8;

var HEADER_WIDTH = 320;
var BODY_MARGIN = 15;

var MAP_VERT_PADDING = 50;
var MAIN_MENU_HEIGHT = 350;

var MAP_BACKGROUND_SIZE_THRESHOLD = (128 + 256) / 2;
var MAP_BACKGROUND_DEFAULT_ZOOM = 12;
var MAP_BACKGROUND_MAX_ZOOM_NON_US = 12;
var MAP_BACKGROUND_MAX_ZOOM_US = 17;

var MAPBOX_MAP_ID = 'codeforamerica.map-mx0iqvk2';

var ADD_YOUR_CITY_URL = 
    'https://github.com/codeforamerica/click_that_hood/wiki/How-to-add-a-city-to-Click-That-%E2%80%99Hood!';

var MAPS_DEFAULT_SCALE = 512;
var D3_DEFAULT_SCALE = 500;

var startTime = 0;
var timerIntervalId;

var totalNeighborhoodsCount;
var neighborhoods = [];
var neighborhoodsToBeGuessed = [];
var neighborhoodsGuessed = [];

var geoData;
var geoMapPath;

var mapClickable = false;
var gameStarted = false;

var easyMode = false;
var mainMenu = false;

var pixelRatio;

var canvasWidth, canvasHeight;
var mapWidth, mapHeight;

var centerLat, centerLon;
var latSpread, lonSpread;

var cityId = '';

var globalScale;

var bodyLoaded = false;
var geoDataLoaded = false;

function lonToTile(lon, zoom) { 
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function latToTile(lat, zoom) { 
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 
      1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

function tileToLon(x, zoom) {
  return x / Math.pow(2, zoom) * 360 - 180;
}

function tileToLat(y, zoom) {
  var n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
  return 180 / Math.PI * Math.atan(.5 * (Math.exp(n) - Math.exp(-n)));
}

function updateCanvasSize() {
  canvasWidth = document.querySelector('#map').offsetWidth;
  canvasHeight = document.querySelector('#map').offsetHeight;

  if (mainMenu) {
    mapWidth = 1536;
    mapHeight = 512;
  } else {
    mapWidth = canvasWidth - HEADER_WIDTH - BODY_MARGIN * 2;
    mapHeight = canvasHeight - MAP_VERT_PADDING * 2;

    // TODO hack
    if (mapHeight < 0) {
      mapHeight = 0;
    }
  }
}

function calculateMapSize() {
  if (mainMenu) {
    geoMapPath = d3.geo.path().projection(
        d3.geo.mercator().center([0, 0]).
        scale(640).
        translate([256 + 512, 256]));
  } else {
    var minLat = 99999999;
    var maxLat = -99999999;
    var minLon = 99999999;
    var maxLon = -99999999;

    // TODO move outside
    function findMinMax(lon, lat) {
      if (lat > maxLat) {
        maxLat = lat;
      }
      if (lat < minLat) {
        minLat = lat;
      }
      if (lon > maxLon) {
        maxLon = lon;
      }
      if (lon < minLon) {
        minLon = lon;
      }
    }

    for (var i in geoData.features) {
      for (var z in geoData.features[i].geometry.coordinates) {
        for (var j in geoData.features[i].geometry.coordinates[z]) {
          if (geoData.features[i].geometry.coordinates[z][j].length && 
              typeof geoData.features[i].geometry.coordinates[z][j][0] != 'number') {
            for (var k in geoData.features[i].geometry.coordinates[z][j]) {
              var lon = geoData.features[i].geometry.coordinates[z][j][k][0];
              var lat = geoData.features[i].geometry.coordinates[z][j][k][1];

              findMinMax(lon, lat);
            }
          } else if (geoData.features[i].geometry.coordinates[z][j].length) {
            var lon = geoData.features[i].geometry.coordinates[z][j][0];
            var lat = geoData.features[i].geometry.coordinates[z][j][1];

            findMinMax(lon, lat);
          }
        }
      }
    }

    centerLat = (minLat + maxLat) / 2;
    centerLon = (minLon + maxLon) / 2;
    latSpread = maxLat - minLat;
    lonSpread = maxLon - minLon;

    updateCanvasSize();

    var zoom = MAP_BACKGROUND_DEFAULT_ZOOM;
    var tile = latToTile(centerLat, zoom);
    var latStep = (tileToLat(tile + 1, zoom) - tileToLat(tile, zoom));

    // Calculate for height first
    // TODO: not entirely sure where these magic numbers are coming from
    globalScale = 
        ((D3_DEFAULT_SCALE * 180) / latSpread * (mapHeight - 50)) / 
            MAPS_DEFAULT_SCALE / 0.045 * (-latStep);

    // Calculate width according to that scale
    var width = globalScale / (D3_DEFAULT_SCALE * 360) * 
        lonSpread * MAPS_DEFAULT_SCALE;

    if (width > mapWidth) {
      globalScale = ((D3_DEFAULT_SCALE * 360) / lonSpread * mapWidth) / 
          MAPS_DEFAULT_SCALE;
    }

    geoMapPath = d3.geo.path().projection(
        d3.geo.mercator().center([centerLon, centerLat]).
        scale(globalScale).translate([mapWidth / 2, mapHeight / 2]));
  }
}

function createSvg() {
  updateCanvasSize();

  mapSvg = d3.select('#svg-container').append('svg')
      .attr('width', mapWidth)
      .attr('height', mapHeight);  
}

function loadGeoData() {
  var url = 'data/' + cityId + '.geojson';
  queue().defer(d3.json, url).await(onGeoDataLoad);
}

function removeSmallNeighborhoods() {
  var els = document.querySelectorAll('#map .neighborhood');

  someSmallNeighborhoodsRemoved = false;

  for (var i = 0, el; el = els[i]; i++) {
    var boundingBox = el.getBBox();

    if ((boundingBox.width < SMALL_NEIGHBORHOOD_THRESHOLD) || 
        (boundingBox.height < SMALL_NEIGHBORHOOD_THRESHOLD)) {
      var name = el.getAttribute('name');

      neighborhoods.splice(neighborhoods.indexOf(name), 1);

      makeNeighborhoodInactive(name);

      totalNeighborhoodsCount--;

      someSmallNeighborhoodsRemoved = true;
    }
  }

  if (someSmallNeighborhoodsRemoved) {
    document.body.classList.add('neighborhoods-removed');
  } else {    
    document.body.classList.remove('neighborhoods-removed');
  }
}

function updateCount() {
  if (totalNeighborhoodsCount <= EASY_MODE_COUNT) {
    easyModeCount = totalNeighborhoodsCount;

    document.body.classList.add('no-difficult-game');
  } else {
    easyModeCount = EASY_MODE_COUNT;
  }

  var els = document.querySelectorAll('.easy-mode-count');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = easyModeCount;
  }

  var els = document.querySelectorAll('.hard-mode-count');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = totalNeighborhoodsCount;
  }
}

function prepareMainMenuMapBackground() {
  updateCanvasSize();

  var el = document.createElement('div');
  el.classList.add('world');

  var layer = mapbox.layer().id(MAPBOX_MAP_ID);
  var map = mapbox.map(document.querySelector('#maps-background'), layer, null, []);
  map.tileSize = { x: Math.round(320 / pixelRatio), 
                   y: Math.round(320 / pixelRatio) };
  map.centerzoom({ lat: 33, lon: 63 }, pixelRatio);
}

function everythingLoaded() {
  if (!mainMenu) {
    calculateMapSize();
    prepareMapBackground();

    prepareNeighborhoods();

    createMap();

    startIntro();
  }
}

function onGeoDataLoad(error, data) {
  geoData = data;

  geoDataLoaded = true;

  checkIfEverythingLoaded();
}

function prepareNeighborhoods() {
  neighborhoods = [];

  for (var i in geoData.features) {
    neighborhoods.push(geoData.features[i].properties.name);
  }
  neighborhoods.sort();

  totalNeighborhoodsCount = neighborhoods.length;
}

function createMainMenuMap() {
  var features = [];

  for (var i in CITY_DATA) {
    var cityData = CITY_DATA[i];

    var feature = {};
    feature.type = 'Feature';
    feature.properties = { id: i };
    feature.geometry = { type: 'Point', coordinates: cityData.sampleLatLon }; 

    features.push(feature);
  }

  mapSvg
    .selectAll('.location')
    .data(features)
    .enter()
    .append('path')
    .attr('d', geoMapPath.pointRadius(1))
    .attr('city-id', function(d) { return d.properties.id; })
    .attr('class', 'location');
}

function animateMainMenuCity(event) {
  var el = event.target;
  while (!el.getAttribute('city-id')) {
    el = el.parentNode;
  }
  var id = el.getAttribute('city-id');

  mapSvg
    .select('#map .location[city-id="' + id + '"]')
    .transition()
    .duration(2000)
    .attr('d', geoMapPath.pointRadius(1000))
    .style('opacity', 0)
    .style('fill-opacity', 0);

  document.querySelector('header.main-menu').classList.add('hidden');
}

function restoreMainMenuCity(event) {
  var el = event.target;
  while (!el.getAttribute('city-id')) {
    el = el.parentNode;
  }
  var id = el.getAttribute('city-id');

  mapSvg
    .select('#map .location[city-id="' + id + '"]')
    .transition()
    .duration(150)
    .attr('d', geoMapPath.pointRadius(1))
    .style('opacity', 1)
    .style('fill-opacity', .1);

  document.querySelector('header.main-menu').classList.remove('hidden');
}

function createMap() {
  mapSvg
    .selectAll('path')
    .data(geoData.features)
    .enter()
    .append('path')
    .attr('d', geoMapPath)
    .attr('class', 'neighborhood unguessed')
    .attr('name', function(d) { return d.properties.name; })
    .on('click', function(d) {
      var el = d3.event.target || d3.event.toElement;

      if (!el.getAttribute('inactive')) {      
        handleNeighborhoodClick(el, d.properties.name);
      }
    })
    .on('mousedown', function(d) {
      d3.event.preventDefault();
    })
    .on('mouseover', function(d) {
      // TODO make a function
      var el = d3.event.target || d3.event.toElement;

      var boundingBox = el.getBBox();

      var hoverEl = document.querySelector('#neighborhood-hover');

      hoverEl.innerHTML = d.properties.name;  

      hoverEl.style.left = 
          (boundingBox.x + boundingBox.width / 2 - hoverEl.offsetWidth / 2) + 'px';
      hoverEl.style.top = (boundingBox.y + boundingBox.height) + 'px';

      hoverEl.classList.add('visible');  

      if (el.getAttribute('inactive')) {
        hoverEl.classList.add('inactive');
      } else {
        hoverEl.classList.remove('inactive');
      }
    })
    .on('mouseout', function(d) {
      // TODO use target
      document.querySelector('#neighborhood-hover').classList.remove('visible');  
    });

  onResize();
}

function setMapClickable(newMapClickable) {
  mapClickable = newMapClickable;

  if (mapClickable) {
    document.body.classList.remove('no-hover');
  } else {
    document.body.classList.add('no-hover');    
  }
}

function animateNeighborhoodGuess(el) {
  var animEl = el.cloneNode(true);
  if (animEl.classList) {
    el.parentNode.appendChild(animEl);

    animEl.classList.remove('guessed');
    animEl.classList.add('guessed-animation');

    window.setTimeout(function() {
      animEl.classList.add('animate');
    }, 0);

    window.setTimeout(function() { animEl.parentNode.removeChild(animEl); }, REMOVE_NEIGHBORHOOD_ANIMATE_GUESS_DELAY);
  }
}

function handleNeighborhoodClick(el, name) {
  if (!mapClickable) {
    return;
  }

  // Assuming accidental click on a neighborhood already guessed
  // TODO does this still work?
  if (neighborhoodsGuessed.indexOf('name') != -1) {
    return;
  }

  setMapClickable(false);

  if (name == neighborhoodToBeGuessedNext) {
    if (el.classList) {
      el.classList.remove('unguessed');
      el.classList.add('guessed');

      animateNeighborhoodGuess(el);
    } else {
      // Fix for early Safari 6 not supporting classes on SVG objects
      el.style.fill = 'rgba(0, 255, 0, .25)';
      el.style.stroke = 'transparent';
    }

    neighborhoodsGuessed.push(name);

    neighborhoodsToBeGuessed.splice(neighborhoodsToBeGuessed.indexOf(name), 1);

    updateGameProgress();

    if (neighborhoodsToBeGuessed.length == 0) {
      gameOver();
    } else {
      window.setTimeout(nextGuess, NEXT_GUESS_DELAY);
    }
  } else {
    if (el.classList) {
      el.classList.remove('unguessed');
      el.classList.add('wrong-guess');
    } else {
      // Fix for early Safari 6 not supporting classes on SVG objects
      el.style.fill = 'rgba(255, 0, 0, .7)';
      el.style.stroke = 'white';
      el.id = 'safari-wrong-guess';
    }

    var correctEl = document.querySelector('#map svg [name="' + neighborhoodToBeGuessedNext + '"]');
    if (correctEl.classList) {
      correctEl.classList.add('right-guess');
    } else {
      // Fix for early Safari 6 not supporting classes on SVG objects
      correctEl.style.webkitAnimationName = 'blink';
      correctEl.style.webkitAnimationDuration = '500ms';
      correctEl.style.webkitAnimationIterationCount = 'infinite';
      correctEl.id = 'safari-right-guess';
    }

    window.setTimeout(removeNeighborhoodHighlights, HIGHLIGHT_DELAY);
    window.setTimeout(nextGuess, HIGHLIGHT_DELAY + NEXT_GUESS_DELAY);
  }

  neighborhoodToBeGuessedNext = '';
  updateNeighborhoodDisplay();
}

function updateGameProgress() {
  document.querySelector('#count').innerHTML = 
      neighborhoodsGuessed.length + ' of ' + 
      (neighborhoodsGuessed.length + neighborhoodsToBeGuessed.length);

  document.querySelector('#count-time-wrapper-wrapper').classList.add('visible');
}

function removeNeighborhoodHighlights() {
  var el = document.querySelector('#map svg .wrong-guess');
  if (el) {
    el.classList.remove('wrong-guess');
    el.classList.add('unguessed');
  }
  var el = document.querySelector('#map svg .right-guess');
  if (el) {
    el.classList.remove('right-guess');
    el.classList.add('unguessed');
  }

  // Fix for early Safari 6 not supporting classes on SVG objects
  var el = document.querySelector('#safari-wrong-guess');
  if (el) {
    el.id = '';
    el.style.stroke = 'white';
    el.style.fill = '';
  }
  var el = document.querySelector('#safari-right-guess');
  if (el) {
    el.id = '';
    el.style.webkitAnimationName = '';
    el.style.stroke = 'white';
    el.style.fill = '';
  }
}

function updateNeighborhoodDisplay() {
  if (neighborhoodToBeGuessedNext) {
    document.querySelector('#neighborhood-guess').classList.add('visible');  
  } else {
    document.querySelector('#neighborhood-guess').classList.remove('visible');      
  }

  document.querySelector('#neighborhood-guess span').innerHTML = 
    neighborhoodToBeGuessedNext;  
}

function nextGuess() {
  setMapClickable(true);

  var pos = Math.floor(Math.random() * neighborhoodsToBeGuessed.length);

  neighborhoodToBeGuessedNext = neighborhoodsToBeGuessed[pos];
  updateNeighborhoodDisplay();
}

function startIntro() {
  document.querySelector('#loading').classList.remove('visible');
  document.querySelector('#intro').classList.add('visible');
}

function makeAllNeighborhoodsActive() {
  var els = document.querySelectorAll('#map svg [inactive]');

  for (var i = 0, el; el = els[i]; i++) {
    el.removeAttribute('inactive');
  } 
}

function makeNeighborhoodInactive(name) {
  var el = document.querySelector('#map svg [name="' + name + '"]');

  el.setAttribute('inactive', true);
}

function removeNeighborhoodsForEasyMode() {
  while (neighborhoodsToBeGuessed.length > EASY_MODE_COUNT) {
    var pos = Math.floor(Math.random() * neighborhoodsToBeGuessed.length);

    var name = neighborhoodsToBeGuessed[pos];

    makeNeighborhoodInactive(name);

    neighborhoodsToBeGuessed.splice(pos, 1);
  }
}

function reloadPage() {
  location.reload();
}

function startGame(useEasyMode) {
  gameStarted = true;

  document.querySelector('#intro').classList.remove('visible');  
  document.querySelector('#cover').classList.remove('visible');

  neighborhoodsToBeGuessed = [];
  for (var i in neighborhoods) {
    neighborhoodsToBeGuessed.push(neighborhoods[i]);
  }

  easyMode = useEasyMode;
  if (easyMode) {
    removeNeighborhoodsForEasyMode();
  }

  updateGameProgress();

  startTime = new Date().getTime();
  timerIntervalId = window.setInterval(updateTimer, 100);

  window.setTimeout(nextGuess, NEXT_GUESS_DELAY);
}

function createTimeout(fn, data, delay) {
  window.setTimeout(function() { fn.call(null, data); }, delay);
}

function gameOver() {
  setMapClickable(false);
  window.clearInterval(timerIntervalId);

  var els = document.querySelectorAll('#map .guessed');

  // TODO constants
  var timer = 300;
  var timerDelta = 100;
  var timerDeltaDiff = 5;
  var TIMER_DELTA_MIN = 10; 

  for (var i = 0, el; el = els[i]; i++) {
    createTimeout(function(el) { animateNeighborhoodGuess(el); }, el, timer);

    timer += timerDelta;
    timerDelta -= timerDeltaDiff;
    if (timerDelta < TIMER_DELTA_MIN) {
      timerDelta = TIMER_DELTA_MIN;
    }
  }

  // TODO constants
  window.setTimeout(gameOverPart2, timer + 1000);
}

function gameOverPart2() {
  document.querySelector('#count-time-wrapper-wrapper').classList.remove('visible');

  document.querySelector('#more-cities-wrapper-wrapper').classList.add('visible');

  document.querySelector('#cover').classList.add('visible');
  document.querySelector(easyMode ? '#congrats-easy' : '#congrats-hard').classList.add('visible');  
}

function updateTimer() {
  var elapsedTime = Math.floor((new Date().getTime() - startTime) / 100);

  var tenthsOfSeconds = elapsedTime % 10;

  var seconds = Math.floor(elapsedTime / 10) % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }

  var minutes = Math.floor(elapsedTime / 600);

  var timeHtml = minutes + ':' + seconds + '.' + tenthsOfSeconds;

  var els = document.querySelectorAll('.time');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = timeHtml;
  } 
}

function prepareMapBackground() {
  if (!geoDataLoaded) {
    return;
  }

  updateCanvasSize();

  // TODO this is the worst line of code ever written
  var size = globalScale * 0.0012238683395795992 * 0.995 / 2 * 0.800 / 2 / 4;

  // TODO remove global
  zoom = MAP_BACKGROUND_DEFAULT_ZOOM + 2;

  while (size < MAP_BACKGROUND_SIZE_THRESHOLD) {
    size *= 2;
    zoom--;
  } 
  // TODO resize properly instead of recreating every single time
  document.querySelector('#maps-background').innerHTML = '';

  var layer = mapbox.layer().id(MAPBOX_MAP_ID);
  var map = mapbox.map(document.querySelector('#maps-background'), layer, null, []);

  if (pixelRatio == 2) {
    zoom++;
  }

  if (CITY_DATA[cityId].stateName) {
    var maxZoomLevel = MAP_BACKGROUND_MAX_ZOOM_US;
  } else {
    var maxZoomLevel = MAP_BACKGROUND_MAX_ZOOM_NON_US;
  }
  while (zoom > maxZoomLevel) {
    zoom--;
    size *= 2;
  }

  map.tileSize = { x: Math.round(size / pixelRatio), 
                   y: Math.round(size / pixelRatio) };

  var tile = latToTile(centerLat, zoom);
  var longStep = 
      (tileToLon(1, zoom) - tileToLon(0, zoom)) / 256 * 128;
  var latStep = 
      (tileToLat(tile + 1, zoom) - tileToLat(tile, zoom)) / 256 * 128;

  var lat = centerLat;
  var lon = centerLon;

  var leftMargin = BODY_MARGIN * 2 + HEADER_WIDTH;

  var ratio = leftMargin / map.tileSize.x;

  lon -= ratio * longStep;
  
  map.centerzoom({ lat: lat, lon: lon }, zoom);
}

function onResize() {
  if (mainMenu) {
    var height = MAIN_MENU_HEIGHT;
  } else {
    var height = window.innerHeight;
  }

  document.querySelector('body > .canvas').style.height = 
    (height - document.querySelector('body > .canvas').offsetTop) + 'px';

  if (mainMenu) {
    calculateMapSize();
  } else {
    if (geoDataLoaded) {
      calculateMapSize();
      prepareMapBackground();

      mapSvg.attr('width', mapWidth);
      mapSvg.attr('height', mapHeight);
      mapSvg.selectAll('path').attr('d', geoMapPath);

      if (!gameStarted) {
        prepareNeighborhoods();
        makeAllNeighborhoodsActive();
        removeSmallNeighborhoods();
        updateCount();
      }
    }
  }
}

function getCityId() {
  var cityMatch = location.href.match(/[\?\&]city=([^&]*)/);

  if (cityMatch && cityMatch[1]) {
    if (CITY_DATA[cityMatch[1]]) {
      cityId = cityMatch[1];
    }
  }      

  if (!cityId) {
    mainMenu = true;
  }
}

function updateFooter() {
  if (CITY_DATA[cityId].dataUrl) {
    document.querySelector('footer .data-source a').href = 
        CITY_DATA[cityId].dataUrl;
    document.querySelector('footer .data-source a').innerHTML = 
        CITY_DATA[cityId].dataTitle;
    document.querySelector('footer .data-source').classList.add('visible');
  }

  if (CITY_DATA[cityId].authorTwitter) {
    document.querySelector('footer .author a').href = 
        'http://twitter.com/' + CITY_DATA[cityId].authorTwitter;
    document.querySelector('footer .author a').innerHTML = 
        '@' + CITY_DATA[cityId].authorTwitter;
    document.querySelector('footer .author').classList.add('visible');
  } 

  if (CITY_DATA[cityId].calloutUrl) {
    var el = document.querySelector('#callout');
    el.innerHTML = CITY_DATA[cityId].calloutTitle;
    el.href = CITY_DATA[cityId].calloutUrl;
    el.classList.add('visible');
  }
}

function resizeLogoIfNecessary() {
  var headerEl = document.querySelector('.canvas > header');
  var el = document.querySelector('.canvas > header .location-name');

  var ratio = el.offsetWidth / headerEl.offsetWidth;

  if (ratio > 1) {
    var el = document.querySelector('.canvas > header .names');

    // TODO const
    el.querySelector('.location-name').style.fontSize = (48 / ratio) + 'px';
    el.querySelector('.state-or-country').style.fontSize = (42 / ratio) + 'px';
  }
}

function prepareLogo() {
  var name = CITY_DATA[cityId].stateName || CITY_DATA[cityId].countryName;

  if (name == COUNTRY_NAME_USA) {
    name = '';
    document.querySelector('header .location-name').classList.add('no-state-or-country');
  } else {
    document.querySelector('header .location-name').classList.remove('no-state-or-country');    
  }
  document.querySelector('header .state-or-country').innerHTML = name;

  document.querySelector('header .annotation').innerHTML = 
      CITY_DATA[cityId].annotation || '';

  var els = document.querySelectorAll('.location-name');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = CITY_DATA[cityId].locationName;
  }

  var neighborhoodNoun = 
      CITY_DATA[cityId].neighborhoodNoun || DEFAULT_NEIGHBORHOOD_NOUN;

  var els = document.querySelectorAll('.neighborhood-noun');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = neighborhoodNoun;
  }

  resizeLogoIfNecessary();
}

function prepareLocationList() {
  var ids = [];
  for (var id in CITY_DATA) {
    ids.push(id);
  }

  ids.sort(function(a, b) {
    return (CITY_DATA[a].longLocationName || CITY_DATA[a].locationName) >
        (CITY_DATA[b].longLocationName || CITY_DATA[b].locationName) ? 1 : -1;
  });

  for (var i in COUNTRY_NAMES) {
    var el = document.createElement('h1');
    el.innerHTML = COUNTRY_NAMES[i];
    document.querySelector('.menu .locations').appendChild(el);

    for (var id in ids) {
      var cityData = CITY_DATA[ids[id]];

      if ((cityData.countryName != COUNTRY_NAMES[i]) && 
          (!cityData.stateName || (COUNTRY_NAMES[i] != COUNTRY_NAME_USA))) {
        continue;
      }

      var el = document.createElement('li');

      el.setAttribute('city-id', ids[id]);

      var html = '<a href="?city=' + ids[id] + '">';

      html += cityData.longLocationName || cityData.locationName;
      if (cityData.annotation) {
        html += '<span class="annotation">' + cityData.annotation + '</span>';
      }
      html += '</a>';
      el.innerHTML = html;

      el.querySelector('a').addEventListener('mouseover', animateMainMenuCity, false);
      el.querySelector('a').addEventListener('mouseout', restoreMainMenuCity, false);

      document.querySelector('.menu .locations').appendChild(el);
    }
  }

  var el = document.createElement('h1');
  el.innerHTML = '';
  document.querySelector('.menu .locations').appendChild(el);

  var el = document.createElement('li');
  el.innerHTML = '<a target="_blank" class="add-your-city" href="' + 
      ADD_YOUR_CITY_URL + '">Add your city…</a>';
  document.querySelector('.menu .locations').appendChild(el);

  if (cityId) {
    var el = document.querySelector('li[city-id="' + cityId + '"]');
    el.classList.add('selected');
  }
}

function prepareMainMenu() {
  document.body.classList.add('main-menu');
}

function getEnvironmentInfo() {
  pixelRatio = window.devicePixelRatio || 1;
}

function removeHttpsIfPresent() {
  // Gets out of HTTPS to do HTTP, because D3 doesn’t allow linking via 
  // HTTPS. But there’s a better way to deal with all of this, I feel
  // (hosting our own copy of D3?).
  if (location.protocol == 'https:') {
    location.replace(location.href.replace(/https:\/\//, 'http://'));
  }
}

function checkIfEverythingLoaded() {
  if ((geoDataLoaded || mainMenu) && bodyLoaded) {
    everythingLoaded();
  }
}

function onBodyLoad() {
  bodyLoaded = true;
  checkIfEverythingLoaded();
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function geoDist(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; // Distance in km
  return d;
}

function receiveGeolocation(position) {
  var lat = position.coords.latitude;
  var lon = position.coords.longitude;

  for (var id in CITY_DATA) {
    var cityData = CITY_DATA[id];

    var cityLat = cityData.sampleLatLon[1];
    var cityLon = cityData.sampleLatLon[0];

    var dist = geoDist(cityLat, cityLon, lat, lon);

    // TODO const
    if (dist < 150) {
      var el = document.querySelector('li[city-id="' + id + '"]');
      el.classList.add('nearby');
    }
  }
}

function prepareGeolocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(receiveGeolocation);
  }
}

function main() {
  window.addEventListener('load', onBodyLoad, false);
  window.addEventListener('resize', onResize, false);

  removeHttpsIfPresent();

  getEnvironmentInfo();
  getCityId();

  prepareLocationList();
  prepareGeolocation();

  onResize();

  if (mainMenu) {
    prepareMainMenu();
    prepareMainMenuMapBackground();

    createSvg();
    calculateMapSize();
    createMainMenuMap();
  } else {
    document.querySelector('#cover').classList.add('visible');
    document.querySelector('#loading').classList.add('visible');

    prepareLogo();
    updateFooter();
    createSvg();
    loadGeoData();
  }

  onResize();
}
