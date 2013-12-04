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

var DEFAULT_NEIGHBORHOOD_NOUN_SINGULAR = 'neighborhood';
var DEFAULT_NEIGHBORHOOD_NOUN_PLURAL = 'neighborhoods';

var EASY_MODE_COUNT = 20;

var HIGHLIGHT_DELAY = 1500;
var NEXT_GUESS_DELAY = 1000;

var REMOVE_NEIGHBORHOOD_ANIMATE_GUESS_DELAY = 2000;

var SMALL_NEIGHBORHOOD_THRESHOLD_MOUSE = 8;
var SMALL_NEIGHBORHOOD_THRESHOLD_TOUCH = 30;

var HEADER_WIDTH = 320;
var BODY_MARGIN = 15;

var MAP_VERT_PADDING = 50;
var MAIN_MENU_HEIGHT = 350;

var MAIN_MENU_MIN_FIXED_HEIGHT = 600;

var MAP_BACKGROUND_SIZE_THRESHOLD = (128 + 256) / 2;
var MAP_BACKGROUND_DEFAULT_ZOOM = 12;
var MAP_BACKGROUND_MAX_ZOOM_NON_US = 12;
var MAP_BACKGROUND_MAX_ZOOM_US = 17;

var MAPBOX_MAP_ID = 'codeforamerica.map-mx0iqvk2';

var ADD_YOUR_CITY_URL = 
    'https://github.com/codeforamerica/click_that_hood/wiki/How-to-add-a-city-to-Click-That-%E2%80%99Hood';

var MAPS_DEFAULT_SCALE = 512;
var D3_DEFAULT_SCALE = 500;

var FACEBOOK_APP_ID = '179106222254519';

var startTime = 0;
var timerIntervalId;

var totalNeighborhoodsCount;
var neighborhoodsDisplayNames = {};

var neighborhoods = [];
var neighborhoodsToBeGuessed = [];
var neighborhoodsGuessed = [];
var neighborhoodToBeGuessedLast;
var neighborhoodToBeGuessedNext;

var geoData;
var geoMapPath;

var mapClickable = false;
var gameStarted = false;

var easyMode = false;
var mainMenu = false;

var touchActive = false;
var currentlyTouching = false;
var lastTouchedNeighborhoodEl;

var pixelRatio;

var smallNeighborhoodThreshold;

var canvasWidth, canvasHeight;
var mapWidth, mapHeight;
var lastMapWidth;

var centerLat, centerLon;
var latSpread, lonSpread;

var currentGeoLat, currentGeoLon;

var cityId = '';

var globalScale;

var bodyLoaded = false;
var geoDataLoaded = false;

var finalTime = null;
var timerStopped = false;

var INITIAL_TOOLTIP_DELAY = 3000; // ms
var MAX_TOOLTIP_DELAY = 5000;
var TOOLTIP_DELAY_THRESHOLD = 3000; // ms

var currentTooltipDelay = INITIAL_TOOLTIP_DELAY;
var currentNeighborhoodStartTime;
var currentNeighborhoodOverThreshold = false;

var defaultLanguage = '';
var language = '';

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
        scale(640 / 6.3).
        translate([256 + 512 + 213 - 88 + (mapWidth % 640) / 2 - 621 / 2, 256]));
  } else {
    // TODO const
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

    // TODO this shouldn’t be hardcoded, but it is. Sue me.

    switch (cityId) {
      case 'africa':
        globalScale *= .8;
        break;
      case 'alaska-ipla':
        globalScale *= .8;
        break;
      case 'south-america':
        globalScale *= .88;
        centerLat -= 5;
        break;
      case 'europe':
        globalScale *= .85;
        centerLat += 6;
        break;
      case 'europe-1914':
        // To match contemporary Europe above
        globalScale *= 1.0915321079;
        centerLat = 55.444707;
        centerLon = 5.8151245;
        break;
      case 'europe-1938': 
        // To match contemporary Europe above
        globalScale *= 1.0915321079;
        centerLat = 55.444707;
        centerLon = 5.8151245;
        break;
      case 'oceania':
        //globalScale *= .5; //TODO: this doesn't seem to be zooming in.
        //centerLon += 150;
        break;
      case 'world':
        globalScale *= .6;
        break;
    }

    // Calculate width according to that scale
    var width = globalScale / (D3_DEFAULT_SCALE * 360) * 
        lonSpread * MAPS_DEFAULT_SCALE;

    if (width > mapWidth) {
      globalScale = ((D3_DEFAULT_SCALE * 360) / lonSpread * mapWidth) / 
          MAPS_DEFAULT_SCALE;
    }

    geoMapPath = d3.geo.path().projection(
        d3.geo.mercator().center([centerLon, centerLat]).
        scale(globalScale / 6.3).translate([mapWidth / 2, mapHeight / 2]));
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

  var request = new XMLHttpRequest();
  request.addEventListener('load', onGeoDataLoad);

  request.addEventListener('progress', function(e) {
     var percentage = e.loaded / e.total * 90;
     document.querySelector('#loading progress').setAttribute('value', percentage);
  }, false);

  request.open("GET", url, true);
  request.send();
}

function updateSmallNeighborhoodDisplay() {
  var count = smallNeighborhoodsRemoved.length;
  var no = Math.floor(Math.random() * count);

  var els = document.querySelectorAll('.small-neighborhood-example');

  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = neighborhoodsDisplayNames[smallNeighborhoodsRemoved[no]];
  }
}

function removeSmallNeighborhoods() {
  var els = document.querySelectorAll('#map .neighborhood');

  smallNeighborhoodsRemoved = [];

  for (var i = 0, el; el = els[i]; i++) {
    var boundingBox = el.getBBox();

    if ((boundingBox.width < smallNeighborhoodThreshold) || 
        (boundingBox.height < smallNeighborhoodThreshold)) {
      var name = el.getAttribute('name');

      neighborhoods.splice(neighborhoods.indexOf(name), 1);

      makeNeighborhoodInactive(name);

      totalNeighborhoodsCount--;

      smallNeighborhoodsRemoved.push(name);
    }
  }

  var count = smallNeighborhoodsRemoved.length;

  if (count) {
    document.body.classList.add('neighborhoods-removed');

    updateSmallNeighborhoodDisplay();
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

  var layer = mapbox.layer().id(MAPBOX_MAP_ID);
  var map = mapbox.map(document.querySelector('#maps-background'), layer, null, []);
  map.tileSize = { x: Math.round(320 / pixelRatio), 
                   y: Math.round(320 / pixelRatio) };
  map.centerzoom({ lat: 26 + 7, lon: 63 - 13 }, pixelRatio);

  lastMapWidth = document.querySelector('#maps-background').offsetWidth;

  // This keeps the map centered on the homepage
  map.addCallback('resized', function(map, dimensions) {
    var width = dimensions[0].x;
    var delta = width - lastMapWidth;
    map.panBy(-Math.floor(delta / 2), 0);
    lastMapWidth += Math.floor(delta / 2) * 2;
  });
}

function isString(obj) {
  return typeof obj == 'string';
}

function findNeighborhoodByPoint(x, y) {
  var el = document.elementFromPoint(x, y);

  if (el) {
    if (el.className && typeof el.className.baseVal == 'string') {
      var className = el.className.baseVal;
    } else {
      var className = el.className;
    }

    // Shitty because iPad has old Safari without classList
    if (className && className.indexOf('neighborhood') != -1) {
      return el;
    }
  } 

  return false;
}

function hoverNeighborhoodElByPoint(x, y, showTooltip) {
  var el = findNeighborhoodByPoint(x, y);

  if (el) {
    hoverNeighborhoodEl(el, showTooltip);
  } else {
    hideNeighborhoodHover();
  }
}

function onBodyTouchStart(event) {
  setTouchActive(true);

  var el = event.target;
  while (el && el.id != 'svg-container') {
    el = el.parentNode;
  }

  if (!el || !el.id || el.id != 'svg-container') {
    return;
  }

  lastTouchedNeighborhoodEl = findNeighborhoodByPoint(event.pageX, event.pageY);

  // TODO duplication with above
  hoverNeighborhoodElByPoint(event.pageX, event.pageY, false);

  currentlyTouching = true;

  event.preventDefault();
}

function onBodyTouchMove(event) {
  if (currentlyTouching) {
    if (event.touches[0]) {
      var x = event.touches[0].pageX;
      var y = event.touches[0].pageY;

      lastTouchedNeighborhoodEl = findNeighborhoodByPoint(x, y);

      // TODO duplication with above
      hoverNeighborhoodElByPoint(x, y, true);
    }

    event.preventDefault();
    event.stopPropagation();
  }
}

function onBodyTouchEnd(event) {
  hideNeighborhoodHover();

  if (lastTouchedNeighborhoodEl) {
    onNeighborhoodClick(lastTouchedNeighborhoodEl);
  }

  currentlyTouching = false;
}

function onBodyTouchCancel(event) {
  hideNeighborhoodHover();

  currentlyTouching = false;
}

function addTouchEventHandlers() {
  document.body.addEventListener('touchstart', onBodyTouchStart, false);
  document.body.addEventListener('touchmove', onBodyTouchMove, false);
  document.body.addEventListener('touchend', onBodyTouchEnd, false);
  document.body.addEventListener('touchcancel', onBodyTouchCancel, false);
}

function determineLanguage() {
  if (CITY_DATA[cityId].languages) {
    for (var name in CITY_DATA[cityId].languages) {
      defaultLanguage = name;
      break;
    }

    for (var name in CITY_DATA[cityId].languages) {
      if ((name != defaultLanguage) && 
          (window.localStorage['prefer-' + name + '-to-' + defaultLanguage] === 'yes')) {
        language = name;
        return;
      }
    }
    language = defaultLanguage;
  }
}

function everythingLoaded() {
  if (!mainMenu) {
    calculateMapSize();
    prepareMapBackground();

    prepareNeighborhoods();
    updateNeighborhoodDisplayNames();

    createMap();

    addTouchEventHandlers();

    startIntro();
  }
}

function onGeoDataLoad(data) {
  geoDataLoaded = true;
  geoData = JSON.parse(this.responseText);
  
  checkIfEverythingLoaded();
}

function updateLanguagesSelector() {
  var els = document.querySelectorAll('header .languages button.selected');
  for (var i = 0, el; el = els[i]; i++) {
    el.classList.remove('selected');
  }

  var el = document.querySelector('header .languages button[name="' + language + '"]');
  el && el.classList.add('selected');
}

function updateNeighborhoodDisplayNames() {
  neighboorhoodsDisplayNames = {};

  for (var i in geoData.features) {
    var name = geoData.features[i].properties.name;

    if (CITY_DATA[cityId].languages) {
      var id = CITY_DATA[cityId].languages[language];
    } else {
      var id = 'name';
    }

    neighborhoodsDisplayNames[name] = geoData.features[i].properties[id];
  }  
}

function prepareNeighborhoods() {
  neighborhoods = [];

  for (var i in geoData.features) {
    var name = geoData.features[i].properties.name;

    neighborhoods.push(name);
  }

  totalNeighborhoodsCount = neighborhoods.length;
}

function createMainMenuMap() {

  // TODO temporarily remove until we fix positioning (issue #156)
  return;

  var features = [];

  for (var i in CITY_DATA) {
    var cityData = CITY_DATA[i];

    var feature = {};
    feature.type = 'Feature';
    feature.properties = { id: i };
    feature.geometry = { type: 'Point', coordinates: cityData.sampleLatLon }; 

    features.push(feature);
  }

  if (currentGeoLat) {
    var feature = {};
    feature.type = 'Feature';
    feature.properties = { id: i, current: true };
    feature.geometry = { type: 'Point', coordinates: [currentGeoLon, currentGeoLat] }; 

    features.push(feature);    
  }

  mapSvg
    .selectAll('.location')
    .data(features)
    .enter()
    .append('path')
    .attr('d', geoMapPath.pointRadius(1))
    .attr('city-id', function(d) { return d.properties.id; })
    .attr('class', function(d) { 
      var name = 'location';
      if (d.properties.current) {
        name += ' current';
      }
      return name;
    });
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

function setTouchActive(newTouchActive) {
  touchActive = newTouchActive;

  if (touchActive) {
    document.body.classList.add('touch-active');
  } else {
    document.body.classList.remove('touch-active');    
  }

  var els = document.querySelectorAll('.click-verb');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = touchActive ? 'touch' : 'click';
  }
}

function showNeighboorhoodTooltip(neighborhoodEl, hoverEl) {
  var name = neighborhoodEl.getAttribute('name');

  hoverEl.classList.remove('visible');  
  hoverEl.innerHTML = neighborhoodsDisplayNames[name];

  var boundingBox = neighborhoodEl.getBBox();

  if (touchActive) {
    var top = boundingBox.y - hoverEl.offsetHeight - 30;
  } else {
    var top = boundingBox.y + boundingBox.height;
  }

  var left = (boundingBox.x + boundingBox.width / 2 - hoverEl.offsetWidth / 2);

  hoverEl.style.top = top + 'px'; 
  hoverEl.style.left = left + 'px';

  if (neighborhoodEl.getAttribute('inactive')) {
    hoverEl.classList.add('inactive');
  } else {
    hoverEl.classList.remove('inactive');
  }

  hoverEl.classList.add('visible');  
}

function hoverNeighborhoodEl(neighborhoodEl, showTooltip) {
  var hoverEl = document.querySelector('#neighborhood-hover');

  var name = neighborhoodEl.getAttribute('name');

  if (showTooltip && ((hoverEl.innerHTML != neighborhoodsDisplayNames[name]) || 
      (!hoverEl.classList.contains('visible')))) {
    showNeighboorhoodTooltip(neighborhoodEl, hoverEl);
  }

  // Fix for Safari 6
  if (!neighborhoodEl.classList) {
    hideSafariNeighborhood();

    if (!neighborhoodEl.id) {
      neighborhoodEl.style.webkitTransition = 'none';
      if (!neighborhoodEl.getAttribute('inactive')) {
        neighborhoodEl.style.fill = 'rgba(247, 148, 29, 0.5)';
      } else {
        neighborhoodEl.style.fill = 'rgba(108, 108, 108, 0.775)';
      }
      neighborhoodEl.id = 'safari-neighborhood-hover';
    }
  }
}

function hideSafariNeighborhood() {
  var el = document.querySelector('#safari-neighborhood-hover');
  if (el) {
    el.id = '';

    if (el.getAttribute('guessed')) {
      el.style.fill = 'rgba(0, 255, 0, .25)';
      el.style.stroke = 'transparent';
    } else {
      el.style.fill = '';      
    }
  }
}

function hideNeighborhoodHover() {
  hideSafariNeighborhood();

  document.querySelector('#neighborhood-hover').classList.remove('visible');
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

      onNeighborhoodClick(el);
    })
    .on('mousedown', function(d) {
      setTouchActive(false);

      d3.event.preventDefault();
    })
    .on('mouseover', function(d) {
      if (!touchActive) {
        var el = d3.event.target || d3.event.toElement;
        hoverNeighborhoodEl(el, true);
      }
    })
    .on('mouseout', function(d) {
      hideNeighborhoodHover();
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
    }, 50);

    window.setTimeout(function() { 
      animEl.parentNode.removeChild(animEl); 
    }, REMOVE_NEIGHBORHOOD_ANIMATE_GUESS_DELAY);
  }
}

function onNeighborhoodClick(el) {
  if (!mapClickable || el.getAttribute('inactive')) {      
    return;
  }

  var name = el.getAttribute('name');

  // Assuming accidental click on a neighborhood already guessed
  // TODO does this still work?
  if (neighborhoodsGuessed.indexOf('name') != -1) {
    return;
  }

  setMapClickable(false);

  var time = new Date().getTime() - currentNeighborhoodStartTime;

  if (name == neighborhoodToBeGuessedNext) {
    if (time > TOOLTIP_DELAY_THRESHOLD) {
      currentTooltipDelay -= time - TOOLTIP_DELAY_THRESHOLD;
      if (currentTooltipDelay < 0) {
        currentTooltipDelay = 0;
      }
    } else {
      currentTooltipDelay += 1000;
      if (currentTooltipDelay > MAX_TOOLTIP_DELAY) {
        currentTooltipDelay = MAX_TOOLTIP_DELAY;
      }
    }

    if (el.classList) {
      el.classList.remove('unguessed');
      el.classList.add('guessed');

      animateNeighborhoodGuess(el);
    } else {
      // Fix for early Safari 6 not supporting classes on SVG objects
      el.style.fill = 'rgba(0, 255, 0, .25)';
      el.style.stroke = 'transparent';

      el.setAttribute('guessed', true);
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
    // Incorrect

    currentTooltipDelay -= 1000;
    if (currentTooltipDelay < 0) {
      currentTooltipDelay = 0;
    }

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

    var correctNameEl = document.querySelector('#neighborhood-correct-name');
    showNeighboorhoodTooltip(correctEl, correctNameEl);

    window.setTimeout(removeNeighborhoodHighlights, HIGHLIGHT_DELAY);
    window.setTimeout(nextGuess, HIGHLIGHT_DELAY + NEXT_GUESS_DELAY);
  }

  neighborhoodToBeGuessedLast = neighborhoodToBeGuessedNext;
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

  var el = document.querySelector('#neighborhood-correct-name');
  if (el) {
    el.classList.remove('visible');
  }

  // Fix for early Safari 6 not supporting classes on SVG objects
  var el = document.querySelector('#safari-wrong-guess');
  if (el) {
    el.id = '';

    if (el.getAttribute('guessed')) {
      el.style.fill = 'rgba(0, 255, 0, .25)';
      el.style.stroke = 'transparent';
    } else {
      el.style.fill = '';      
      el.style.stroke = 'white';
    }
  }
  var el = document.querySelector('#safari-right-guess');
  if (el) {
    el.id = '';
    el.style.webkitAnimationName = '';
    el.style.stroke = 'white';
    el.style.fill = '';
  }
}

function updateNeighborhoodDisplayName() {
  document.querySelector('#neighborhood-guess .name').innerHTML = 
    neighborhoodsDisplayNames[neighborhoodToBeGuessedNext];  
}

function updateNeighborhoodDisplay() {
  if (neighborhoodToBeGuessedNext) {
    updateNeighborhoodDisplayName();

    document.querySelector('#neighborhood-guess-wrapper').classList.add('visible');  
  } else {
    document.querySelector('#neighborhood-guess-wrapper').classList.remove('visible');      
    document.querySelector('#neighborhood-guess-wrapper').classList.add('invisible');  

    window.setTimeout(function() {
      document.querySelector('#neighborhood-guess-wrapper').classList.remove('invisible');
    }, 150);
  }

}

function nextGuess() {
  setMapClickable(true);

  currentNeighborhoodStartTime = new Date().getTime();
  currentNeighborhoodOverThreshold = false;
  hideTooltips();

  do {
    var pos = Math.floor(Math.random() * neighborhoodsToBeGuessed.length);
    neighborhoodToBeGuessedNext = neighborhoodsToBeGuessed[pos];
  } while ((neighborhoodToBeGuessedLast == neighborhoodToBeGuessedNext) &&
           (neighborhoodsToBeGuessed.length > 1));
  updateNeighborhoodDisplay();
}

function startIntro() {
  document.querySelector('#loading').classList.remove('visible');
  document.querySelector('#select-mode').classList.add('visible');
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
  document.querySelector('#select-mode').classList.remove('visible');  
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
  updateTimer();
  
  window.setTimeout(function() {
    startTime = new Date().getTime();
    timerIntervalId = window.setInterval(updateTimer, 100);
  }, NEXT_GUESS_DELAY);

  window.setTimeout(nextGuess, NEXT_GUESS_DELAY);
}

function createTimeout(fn, data, delay) {
  window.setTimeout(function() { fn.call(null, data); }, delay);
}

function stopTimer() {
  timerStopped = true;
  finalTime = new Date().getTime();
  window.clearInterval(timerIntervalId);  

  updateTimer();
}

function gameOver() {
  stopTimer();

  setMapClickable(false);
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

function getSharingMessage() {
  return 'I just played Click That ’Hood and identified ' + 
      neighborhoodsGuessed.length + ' ' + CITY_DATA[cityId].locationName + ' ' + 
      getNeighborhoodNoun(true) + ' in ' + getTimer() + '. Try to beat me!';
}

function updateFacebookLink(congratsEl) {
  var el = congratsEl.querySelector('#share-via-facebook');

  var text = getSharingMessage();
  var url = location.href;

  el.href = 'https://www.facebook.com/dialog/feed?' +
      'app_id=' + FACEBOOK_APP_ID +
      '&redirect_uri=' + encodeURIComponent(url) + 
      '&link=' + encodeURIComponent(url) + 
      '&name=' + encodeURIComponent('Click That ’Hood') +
      '&description=' + encodeURIComponent(text);
}

function updateTwitterLink(congratsEl) {
  var el = congratsEl.querySelector('#share-via-twitter');

  var text = getSharingMessage();
  var url = location.href;

  el.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + 
      '&url=' + encodeURIComponent(url);
}

function gameOverPart2() {
  var el = document.querySelector(easyMode ? '#congrats-easy' : '#congrats-hard');

  document.querySelector('#count-time-wrapper-wrapper').classList.remove('visible');
  document.querySelector('#more-cities-wrapper-wrapper').classList.add('visible');

  updateTwitterLink(el);
  updateFacebookLink(el);

  document.querySelector('#cover').classList.add('visible');
  el.classList.add('visible');  
}

function getTimer() {
  if (!timerStopped) {
    var time = new Date().getTime();
  } else {
    var time = finalTime;
  }

  var elapsedTime = Math.floor((time - startTime) / 100);

  var tenthsOfSeconds = elapsedTime % 10;

  var seconds = Math.floor(elapsedTime / 10) % 60;
  if (seconds < 10) {
    seconds = '0' + seconds;
  }

  var minutes = Math.floor(elapsedTime / 600);

  return minutes + ':' + seconds + '.' + tenthsOfSeconds;
}

function hideTooltips() {
  document.querySelector('#neighborhood-hover').classList.remove('active');
}

function showTooltips() {
  document.querySelector('#neighborhood-hover').classList.add('active');
}

function updateTimer() {
  var timeHtml = getTimer();

  var els = document.querySelectorAll('.time');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = timeHtml;
  } 

  if (!currentNeighborhoodOverThreshold) {
    var time = new Date().getTime() - currentNeighborhoodStartTime;

    if (time > currentTooltipDelay) {
      currentNeighborhoodOverThreshold = true;
      showTooltips();
    }
  }
}

function prepareMapBackground() {
  if (!geoDataLoaded) {
    return;
  }

  updateCanvasSize();

  // TODO this is the worst line of code ever written
  var size = globalScale * 0.0012238683395795992 * 0.995 / 2 * 0.800 / 2 / 4;

  var zoom = MAP_BACKGROUND_DEFAULT_ZOOM + 2;

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

    // TODO temporarily remove until we fix positioning (issue #156)
    document.body.classList.add('no-fixed-main-menu');
    /*if (window.innerHeight > MAIN_MENU_MIN_FIXED_HEIGHT) {
      document.body.classList.remove('no-fixed-main-menu');
    } else {
      document.body.classList.add('no-fixed-main-menu');      
    }*/
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
  var cityMatch = location.href.match(/[\?\&](city|location)=([^&]*)/);

  if (cityMatch && cityMatch[2]) {
    if (CITY_DATA[cityMatch[2]]) {
      cityId = cityMatch[2];
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

function getNeighborhoodNoun(plural) {
  if (!plural) {
    return (CITY_DATA[cityId].neighborhoodNoun && CITY_DATA[cityId].neighborhoodNoun[0]) || DEFAULT_NEIGHBORHOOD_NOUN_SINGULAR;
  } else { 
    return (CITY_DATA[cityId].neighborhoodNoun && CITY_DATA[cityId].neighborhoodNoun[1]) || DEFAULT_NEIGHBORHOOD_NOUN_PLURAL;
  }
}

function preparePage() {
  var name = CITY_DATA[cityId].stateName || CITY_DATA[cityId].countryName || '';

  // TODO don’t hardcode!
  if (!name || (name == COUNTRY_NAME_USA) || (name == CITY_DATA[cityId].locationName) || 
      ((name == 'U.K.') && (CITY_DATA[cityId].locationName == 'United Kingdom'))) {
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

  var neighborhoodNoun = getNeighborhoodNoun(false);
  var els = document.querySelectorAll('.neighborhood-noun');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = neighborhoodNoun;
  }

  var neighborhoodNounPlural = getNeighborhoodNoun(true);
  var els = document.querySelectorAll('.neighborhood-nouns');
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = neighborhoodNounPlural;
  }

  if (CITY_DATA[cityId].languages) {
    for (var name in CITY_DATA[cityId].languages) {
      var buttonEl = document.createElement('button');
      buttonEl.innerHTML = name;
      buttonEl.setAttribute('name', name);

      buttonEl.addEventListener('click', languageChange);

      document.querySelector('header .languages').appendChild(buttonEl);
    }
  }

  resizeLogoIfNecessary();
}

function languageChange(event) {
  var el = event.target;

  var newLanguage = event.target.getAttribute('name');
  if (language == newLanguage) {
    return;
  }

  if (language != defaultLanguage) {
    delete window.localStorage['prefer-' + language + '-to-' + defaultLanguage];
  }

  if (newLanguage != defaultLanguage) {
    window.localStorage['prefer-' + newLanguage + '-to-' + defaultLanguage] = 'yes';
  }

  language = newLanguage;

  updateLanguagesSelector();
  updateNeighborhoodDisplayNames();
  updateNeighborhoodDisplayName();
  updateSmallNeighborhoodDisplay();
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
          (!cityData.stateName || (COUNTRY_NAMES[i] != COUNTRY_NAME_USA)) &&
          (cityData.stateName || cityData.countryName || (COUNTRY_NAMES[i] != 'The World'))) {
        continue;
      }

      var el = document.createElement('li');

      el.setAttribute('city-id', ids[id]);

      var url = '?location=' + ids[id];

      var html = '<a href="' + url + '">';

      html += cityData.longLocationName || cityData.locationName;
      if (cityData.annotation) {
        html += '<span class="annotation">' + cityData.annotation + '</span>';
      }
      html += '</a>';
      el.innerHTML = html;

      // TODO temporarily remove until we fix positioning (issue #156)

      /*
      el.querySelector('a').addEventListener('mouseover', animateMainMenuCity, false);
      el.querySelector('a').addEventListener('mouseout', restoreMainMenuCity, false);
      */

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
  setTouchActive(Modernizr.touch);
  pixelRatio = window.devicePixelRatio || 1;

  if (touchActive) {
    smallNeighborhoodThreshold = SMALL_NEIGHBORHOOD_THRESHOLD_TOUCH;
  } else {
    smallNeighborhoodThreshold = SMALL_NEIGHBORHOOD_THRESHOLD_MOUSE;
  }
  
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
  currentGeoLat = position.coords.latitude;
  currentGeoLon = position.coords.longitude;

  for (var id in CITY_DATA) {
    var cityData = CITY_DATA[id];

    var cityLat = cityData.sampleLatLon[1];
    var cityLon = cityData.sampleLatLon[0];

    var dist = geoDist(cityLat, cityLon, currentGeoLat, currentGeoLon);

    // TODO const
    if (dist < 150) {
      var el = document.querySelector('li[city-id="' + id + '"]');
      el.classList.add('nearby');
    }
  }

  if (mainMenu) {
    createMainMenuMap();
  }
}

function prepareGeolocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(receiveGeolocation);
  }
}

function onMoreCitiesClick() {
  document.body.scrollTop = window.innerHeight;
}

function testBrowser() {
  var goodEnoughBrowser = document.body.classList;

  if (!goodEnoughBrowser) {
    document.getElementById('wrong-browser').className += ' visible';

    return goodEnoughBrowser;
  }

  var mobile = window.matchMedia && window.matchMedia('(max-device-width: 568px)').matches;

  if (mobile) {
    document.getElementById('mobile').className += ' visible';
    document.querySelector('#mobile button').addEventListener('click', ignoreMobileBrowserWarning);
  }

  return !mobile;
}

function ignoreMobileBrowserWarning() {
  document.getElementById('mobile').className = '';
  browserIsOkay();
}

function browserIsOkay() {
  window.addEventListener('load', onBodyLoad, false);
  window.addEventListener('resize', onResize, false);

  document.querySelector('#more-cities-wrapper div').
      addEventListener('click', onMoreCitiesClick, false);

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
    document.querySelector('#intro').classList.add('visible');

    determineLanguage();
    preparePage();
    updateLanguagesSelector();
    updateFooter();
    createSvg();
    loadGeoData();
  }

  onResize();
}

function main() {
  removeHttpsIfPresent();

  if (testBrowser()) {
    browserIsOkay();
  }
}
