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

var COUNTRY_NAME_USA = 'U.S.'
var COUNTRY_NAME_WORLD = 'The World'

var DEFAULT_NEIGHBORHOOD_NOUN_SINGULAR = 'neighborhood'
var DEFAULT_NEIGHBORHOOD_NOUN_PLURAL = 'neighborhoods'

var EASY_MODE_COUNT = 20

var HIGHLIGHT_DELAY = 1500
var NEXT_GUESS_DELAY = 1000

var REMOVE_NEIGHBORHOOD_ANIMATE_GUESS_DELAY = 2000

var SMALL_NEIGHBORHOOD_THRESHOLD_MOUSE = 8
var SMALL_NEIGHBORHOOD_THRESHOLD_TOUCH = 30

var HEADER_WIDTH = 320
var BODY_MARGIN = 15

var MAP_VERT_PADDING = 50
var MAIN_MENU_HEIGHT = 350

var MAIN_MENU_MIN_FIXED_HEIGHT = 600

var MAP_BACKGROUND_SIZE_THRESHOLD = (128 + 256) / 2
var MAP_BACKGROUND_DEFAULT_ZOOM = 12
var MAP_BACKGROUND_MAX_ZOOM_NON_US = 17
var MAP_BACKGROUND_MAX_ZOOM_US = 17

var POINT_SCALE = 75000
var MIN_POINT_RADIUS = 16

var MAPBOX_MAP_ID = 'codeforamerica.map-mx0iqvk2'

var ADD_YOUR_CITY_URL = 
    'https://github.com/codeforamerica/click_that_hood/wiki/How-to-add-a-city-to-Click-That-%E2%80%99Hood'

var MAPS_DEFAULT_SCALE = 512
var D3_DEFAULT_SCALE = 500

var FACEBOOK_APP_ID = '179106222254519'

var startTime = 0
var timerIntervalId

var totalNeighborhoodsCount
var neighborhoodsDisplayNames = {}

var neighborhoods = []
var neighborhoodsToBeGuessed = []
var neighborhoodsGuessed = []
var neighborhoodToBeGuessedLast
var neighborhoodToBeGuessedNext

var geoData
var geoMapPath

var mapClickable = false
var gameStarted = false

var easyMode = false
var mainMenu = false

var touchActive = false
var currentlyTouching = false
var lastTouchedNeighborhoodEl

var pixelRatio

var smallNeighborhoodThreshold

var canvasWidth, canvasHeight
var mapWidth, mapHeight
var lastMapWidth

var centerLat, centerLon
var latSpread, lonSpread

var MAP_HORIZONTAL_OFFSET_NORMAL = 0
var MAP_HORIZONTAL_OFFSET_REVERSED = 1

var mapHorizontalOffset = MAP_HORIZONTAL_OFFSET_NORMAL

var currentGeoLat, currentGeoLon

var cityId = ''

var globalScale

var bodyLoaded = false
var geoDataLoaded = false

var finalTime = null
var timerStopped = false

var INITIAL_TOOLTIP_DELAY = 3000 // ms
var MAX_TOOLTIP_DELAY = 5000
var TOOLTIP_DELAY_THRESHOLD = 3000 // ms
var TOOLTIP_INCREMENT = 1000

var currentTooltipDelay = INITIAL_TOOLTIP_DELAY
var currentNeighborhoodStartTime
var currentNeighborhoodOverThreshold = false

var defaultLanguage = ''
var language = ''

// ---

function splitPathIntoSeparateSegments(path) {
  var segList = []

  var segs = []
  var s = path.pathSegList
  var count = s.numberOfItems
  for (var i = 0; i < count; i++) {
    var item = s.getItem(i)
    segs.push(item)

    if (item.pathSegType == SVGPathSeg.PATHSEG_CLOSEPATH) {
      segList.push(segs)
      segs = []
    }
  }

  if (segs.length) {
    segList.push(segs)
  }

  for (var i in segList) {
    segList[i].reverse()
  }

  return segList
}

//*** This code is copyright 2011 by Gavin Kistner, !@phrogz.net
//*** It is covered under the license viewable at http://phrogz.net/JS/_ReuseLicense.txt
// The following function is taken from Gavin Kistner as above. 
// It’s been modified in the following ways:
// · assuming local document
// · sampling every point (removing sampling logic)
// · splitting path into separate ones via splitPathIntoSeparateSegments
//   (e.g. one path with three islands = three separate ones)
// · prettified the code

function pathToPolygon(segs) {
  var poly = document.createElementNS('http://www.w3.org/2000/svg','polygon')

  var segments = segs.concat()

  var points = []

  var addSegmentPoint = function(s) {
    if (s.pathSegType != SVGPathSeg.PATHSEG_CLOSEPATH) {
      if (s.pathSegType % 2 == 1 && s.pathSegType > 1) {
        // All odd-numbered path types are relative, except PATHSEG_CLOSEPATH (1)
        x += s.x
        y += s.y
      } else {
        x = s.x
        y = s.y
      }         
      var lastPoint = points[points.length - 1]
      if (!lastPoint || x != lastPoint[0] || y != lastPoint[1]) {
        points.push([x, y])
      }
    }
  }

  for (var d = 0, len = segments.length; d < len; d++) {
    addSegmentPoint(segs.shift())
  }
  for (var i = 0, len = segs.length; i < len; ++i) {
    addSegmentPoint(segs[i])
  }
  for (var i = 0, len = points.length; i < len; ++i) {
    points[i] = points[i].join(',')
  }

  poly.setAttribute('points', points.join(' '))
  
  return poly
}

function getPolygonArea(poly) {
  var area = 0
  var pts = poly.points
  var len = pts.numberOfItems

  for (var i = 0; i < len; ++i) {
    var p1 = pts.getItem(i)
    var p2 = pts.getItem((i + len - 1) % len)

    area += (p2.x + p1.x) * (p2.y - p1.y)
  }
  return Math.abs(area / 2)
}

function lonToTile(lon, zoom) { 
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom))
}

function latToTile(lat, zoom) { 
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 
      1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))
}

function tileToLon(x, zoom) {
  return x / Math.pow(2, zoom) * 360 - 180
}

function tileToLat(y, zoom) {
  var n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom)
  return 180 / Math.PI * Math.atan(.5 * (Math.exp(n) - Math.exp(-n)))
}

function getPointRadius() { 
  var radius = globalScale / POINT_SCALE
  if (radius < MIN_POINT_RADIUS) {
    radius = MIN_POINT_RADIUS
  }

  return radius
}

function updateCanvasSize() {
  canvasWidth = document.querySelector('#map').offsetWidth
  canvasHeight = document.querySelector('#map').offsetHeight

  if (mainMenu) {
    mapWidth = 1536
    mapHeight = 512
  } else {
    mapWidth = canvasWidth - HEADER_WIDTH - BODY_MARGIN * 2
    mapHeight = canvasHeight - MAP_VERT_PADDING * 2

    // TODO hack
    if (mapHeight < 0) {
      mapHeight = 0
    }
  }
}

function findBoundaries() {
  // TODO const
  var minLat = 99999999
  var maxLat = -99999999
  var minLon = 99999999
  var maxLon = -99999999

  // TODO move outside
  function findMinMax(lon, lat) {
    switch (mapHorizontalOffset) {
      case MAP_HORIZONTAL_OFFSET_REVERSED:
        lon += 360
        lon %= 360
        break
    }

    if (lat > maxLat) {
      maxLat = lat
    }
    if (lat < minLat) {
      minLat = lat
    }

    if (lon > maxLon) {
      maxLon = lon
    }
    if (lon < minLon) {
      minLon = lon
    }
  }

  for (var i in geoData.features) {
    if (CITY_DATA[cityId].pointsInsteadOfPolygons) {
      var lon = geoData.features[i].geometry.coordinates[0]
      var lat = geoData.features[i].geometry.coordinates[1]

      if (lon.length) {
        lon = geoData.features[i].geometry.coordinates[0][0]
        lat = geoData.features[i].geometry.coordinates[0][1]

        if (lon.length) {
          lon = geoData.features[i].geometry.coordinates[0][0][0]
          lat = geoData.features[i].geometry.coordinates[0][0][1]

          if (lon.length) {
            lon = geoData.features[i].geometry.coordinates[0][0][0][0]
            lat = geoData.features[i].geometry.coordinates[0][0][0][1]
          }
        }
      }

      // Rewrite
      geoData.features[i].geometry.coordinates = [lon, lat]

      findMinMax(lon, lat)
    } else {
      for (var z in geoData.features[i].geometry.coordinates) {
        for (var j in geoData.features[i].geometry.coordinates[z]) {
          if (geoData.features[i].geometry.coordinates[z][j].length && 
              typeof geoData.features[i].geometry.coordinates[z][j][0] != 'number') {
            for (var k in geoData.features[i].geometry.coordinates[z][j]) {
              var lon = geoData.features[i].geometry.coordinates[z][j][k][0]
              var lat = geoData.features[i].geometry.coordinates[z][j][k][1]

              findMinMax(lon, lat)
            }
          } else if (geoData.features[i].geometry.coordinates[z][j].length) {
            var lon = geoData.features[i].geometry.coordinates[z][j][0]
            var lat = geoData.features[i].geometry.coordinates[z][j][1]

            findMinMax(lon, lat)
          }
        }
      }
    }
  }

  return { 
    minLat: minLat,
    maxLat: maxLat,
    minLon: minLon,
    maxLon: maxLon
  }
}

function calculateMapSize() {
  if (mainMenu) {
    geoMapPath = d3.geo.path().projection(
        d3.geo.mercator().center([0, 0]).
        scale(640 / 6.3).
        translate([256 + 512 + 213 - 88 + (mapWidth % 640) / 2 - 621 / 2, 256]))
  } else {
    var boundaries = findBoundaries()

    if ((boundaries.minLon == -180) && (boundaries.maxLon == 180)) {
      mapHorizontalOffset = MAP_HORIZONTAL_OFFSET_REVERSED
      boundaries = findBoundaries()
    }

    centerLat = (boundaries.minLat + boundaries.maxLat) / 2
    centerLon = (boundaries.minLon + boundaries.maxLon) / 2
    latSpread = boundaries.maxLat - boundaries.minLat
    lonSpread = boundaries.maxLon - boundaries.minLon

    if (CITY_DATA[cityId].pointsInsteadOfPolygons) {
      latSpread *= 1.1
      lonSpread *= 1.1
    }

    updateCanvasSize()

    var zoom = MAP_BACKGROUND_DEFAULT_ZOOM
    var tile = latToTile(centerLat, zoom)
    var latStep = (tileToLat(tile + 1, zoom) - tileToLat(tile, zoom))

    // Calculate for height first
    // TODO: not entirely sure where these magic numbers are coming from
    globalScale = 
        ((D3_DEFAULT_SCALE * 180) / latSpread * (mapHeight - 50)) / 
            MAPS_DEFAULT_SCALE / .045 * (-latStep)

    // TODO this shouldn’t be hardcoded, but it is. Sue me.

    switch (cityId) {
      case 'africa':
        globalScale *= .8
        break
      case 'alaska-ipla':
        globalScale *= .8
        break
      case 'south-america':
        globalScale *= .88
        centerLat -= 5
        break
      case 'europe':
        globalScale *= .85
        centerLat += 6
        break
      case 'russia':
        globalScale *= .8
        centerLat += 6
        break
      case 'asia':
        globalScale *= .7
        centerLat += 20
        break
      case 'europe-1914':
        // To match contemporary Europe above
        globalScale *= 1.0915321079
        centerLat = 55.444707
        centerLon = 5.8151245
        break
      case 'europe-1938': 
        // To match contemporary Europe above
        globalScale *= 1.0915321079
        centerLat = 55.444707
        centerLon = 5.8151245
        break
      case 'oceania':
        globalScale *= .8
        break
      case 'world':
        globalScale *= .6
        break
    }

    // Calculate width according to that scale
    var width = globalScale / (D3_DEFAULT_SCALE * 360) * 
        lonSpread * MAPS_DEFAULT_SCALE

    if (width > mapWidth) {
      globalScale = ((D3_DEFAULT_SCALE * 360) / lonSpread * mapWidth) / 
          MAPS_DEFAULT_SCALE
    }

    projection = d3.geo.mercator()
    switch (mapHorizontalOffset) {
      case MAP_HORIZONTAL_OFFSET_NORMAL:
        projection = projection.center([centerLon, centerLat])
        break
      case MAP_HORIZONTAL_OFFSET_REVERSED:
        projection = projection.center([centerLon - 180, centerLat]).
            rotate([180, 0])
        break
    }
    projection = projection.scale(globalScale / 6.3).
        translate([mapWidth / 2, mapHeight / 2])

    geoMapPath = d3.geo.path().projection(projection)
  }
}

function createSvg() {
  updateCanvasSize()

  mapSvg = d3.select('#svg-container').append('svg')
      .attr('width', mapWidth)
      .attr('height', mapHeight)
}

function loadGeoData() {
  var url = 'data/' + cityId + '.geojson'

  var request = new XMLHttpRequest()
  request.addEventListener('load', onGeoDataLoad)

  request.addEventListener('progress', function(e) {
     var percentage = e.loaded / e.total * 90
     document.querySelector('#loading progress').setAttribute('value', percentage)
  }, false)

  request.open('GET', url, true)
  request.send()
}

function updateSmallNeighborhoodDisplay() {
  var count = smallNeighborhoodsRemoved.length
  var no = Math.floor(Math.random() * count)

  var els = document.querySelectorAll('.small-neighborhood-example')

  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = neighborhoodsDisplayNames[smallNeighborhoodsRemoved[no]]
  }
}

function removeCompositePoints() {
  var els = document.querySelectorAll('#map .neighborhood[point]')

  for (var i = 0, el; el = els[i]; i++) {
    el.removeAttribute('fused')
    el.removeAttribute('composited')
    el.removeAttribute('names')

    /*if (el.getAttribute('origTransformX')) {
      var x = el.getAttribute('origTransformX')
      var y = el.getAttribute('origTransformY')
      el.setAttribute('transformX', x)
      el.setAttribute('transformY', y)
      el.setAttribute('transform', "translate(" + (x + radius / 2) + ',' + (y + radius / 2) + ")")
    }*/
  }  
}

function addCompositePoints() {
  var els = document.querySelectorAll('#map .neighborhood[point]')
  var radius = getPointRadius()

  do {
    var lastFusedCount = 0

    for (var i = 0, el1; el1 = els[i]; i++) {
      if (el1.getAttribute('fused')) {
        continue;
      }

      var x1 = parseFloat(el1.getAttribute('transformX'))
      var y1 = parseFloat(el1.getAttribute('transformY'))

      for (var j = 0, el2; el2 = els[j]; j++) {
        if ((i == j) || el2.getAttribute('fused')) {
          continue;
        }

        var x2 = parseFloat(el2.getAttribute('transformX'))
        var y2 = parseFloat(el2.getAttribute('transformY'))

        var dist = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1))

        if (dist < radius) {
          var newX = (x1 + x2) / 2
          var newY = (y1 + y2) / 2

          el1.setAttribute('composited', true)
          if (el1.getAttribute('names')) {
            var names = JSON.parse(el1.getAttribute('names'))
          } else {
            var names = [el1.getAttribute('name')]
          }

          if (el2.getAttribute('composited')) {
            var newNames = JSON.parse(el2.getAttribute('names'))
            for (var k in newNames) {
              names.push(newNames[k])
            }
          } else {
            names.push(el2.getAttribute('name'))
          }
          el1.setAttribute('names', JSON.stringify(names))
          el1.setAttribute('transformX', newX)
          el1.setAttribute('transformY', newY)
          el1.setAttribute('transform', "translate(" + (newX + radius / 2) + ',' + (newY + radius / 2) + ")")

          el2.setAttribute('fused', true)
        
          lastFusedCount++
        }
      }
    }
  } while (lastFusedCount > 0)
}

function removeAutomaticallyPointedNeighborhoods() {
  var els = document.querySelectorAll('#map .neighborhood')
  for (var i = 0, el; el = els[i]; i++) {
    if (el.getAttribute('origD')) {
      el.setAttribute('d', el.getAttribute('origD'))
      el.removeAttribute('transformX')
      el.removeAttribute('transformY')
      el.removeAttribute('transform')
      el.removeAttribute('point')

      el.removeAttribute('origD')
    }
  }  
}

function removeSmallNeighborhoods() {
  smallNeighborhoodsRemoved = []

  // If using points instead of polygons, there is no way for a neighborhood to be too small.
  if (CITY_DATA[cityId].pointsInsteadOfPolygons) {
    return
  }

  var radius = getPointRadius()

  var els = document.querySelectorAll('#map .neighborhood')
  for (var i = 0, el; el = els[i]; i++) {
    var boundingBox = el.getBBox()
    if ((boundingBox.width < smallNeighborhoodThreshold) || 
        (boundingBox.height < smallNeighborhoodThreshold)) {

      if (CITY_DATA[cityId].convertPolygonsToPointsIfTooSmall) {
        var boundingBox = el.getBBox()

        var x = boundingBox.x + boundingBox.width / 2
        var y = boundingBox.y + boundingBox.height / 2

        el.setAttribute('origD', el.getAttribute('d'))
        el.setAttribute('d', d3.svg.symbol().type('square').size(radius * radius)())
        el.setAttribute('point', true)
        el.setAttribute('transformX', x - radius / 2)
        el.setAttribute('transformY', y - radius / 2)
        el.setAttribute('transform', "translate(" + x + "," + y + ")")
      } else {
        if (!gameStarted) {
          var name = el.getAttribute('name')
          neighborhoods.splice(neighborhoods.indexOf(name), 1)
          totalNeighborhoodsCount--
          smallNeighborhoodsRemoved.push(name)
        }
      }
    }
  }

  var count = smallNeighborhoodsRemoved.length

  if (count) {
    document.body.classList.add('neighborhoods-removed')

    updateSmallNeighborhoodDisplay()
  } else {    
    document.body.classList.remove('neighborhoods-removed')
  }
}

function updateCount() {
  if (totalNeighborhoodsCount <= EASY_MODE_COUNT) {
    easyModeCount = totalNeighborhoodsCount

    document.body.classList.add('no-difficult-game')
  } else {
    easyModeCount = EASY_MODE_COUNT
  }

  var els = document.querySelectorAll('.easy-mode-count')
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = easyModeCount
  }

  var els = document.querySelectorAll('.hard-mode-count')
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = totalNeighborhoodsCount
  }
}

function prepareMainMenuMapBackground() {
  updateCanvasSize()

  if (typeof mapbox != 'undefined') {
    var layer = mapbox.layer().id(MAPBOX_MAP_ID)
    var map = mapbox.map(document.querySelector('#maps-background'), layer, null, [])
    map.tileSize = { x: Math.round(320 / pixelRatio), 
                     y: Math.round(320 / pixelRatio) }
    map.centerzoom({ lat: 26 + 7, lon: 63 - 13 }, pixelRatio)
  }

  lastMapWidth = document.querySelector('#maps-background').offsetWidth

  if (typeof mapbox != 'undefined') {
    // This keeps the map centered on the homepage
    map.addCallback('resized', function(map, dimensions) {
      var width = dimensions[0].x
      var delta = width - lastMapWidth
      map.panBy(-Math.floor(delta / 2), 0)
      lastMapWidth += Math.floor(delta / 2) * 2
    })
  }
}

function isString(obj) {
  return typeof obj == 'string'
}

function findNeighborhoodByPoint(x, y) {
  var el = document.elementFromPoint(x, y)

  if (el) {
    if (el.className && typeof el.className.baseVal == 'string') {
      var className = el.className.baseVal
    } else {
      var className = el.className
    }

    // Shitty because iPad has old Safari without classList
    if (className && className.indexOf('neighborhood') != -1) {
      return el
    }
  } 

  return false
}

function hoverNeighborhoodElByPoint(x, y, showTooltip) {
  var el = findNeighborhoodByPoint(x, y)

  if (el) {
    hoverNeighborhoodEl(el, showTooltip)
  } else {
    hideNeighborhoodHover()
  }
}

function onBodyTouchStart(event) {
  setTouchActive(true)

  var el = event.target
  while (el && el.id != 'svg-container') {
    el = el.parentNode
  }

  if (!el || !el.id || el.id != 'svg-container') {
    return
  }

  lastTouchedNeighborhoodEl = findNeighborhoodByPoint(event.pageX, event.pageY)

  // TODO duplication with above
  hoverNeighborhoodElByPoint(event.pageX, event.pageY, false)

  currentlyTouching = true

  event.preventDefault()
}

function onBodyTouchMove(event) {
  if (currentlyTouching) {
    if (event.touches[0]) {
      var x = event.touches[0].pageX
      var y = event.touches[0].pageY

      lastTouchedNeighborhoodEl = findNeighborhoodByPoint(x, y)

      // TODO duplication with above
      hoverNeighborhoodElByPoint(x, y, true)
    }

    event.preventDefault()
    event.stopPropagation()
  }
}

function onBodyTouchEnd(event) {
  hideNeighborhoodHover()

  if (lastTouchedNeighborhoodEl) {
    onNeighborhoodClick(lastTouchedNeighborhoodEl)
  }

  currentlyTouching = false
}

function onBodyTouchCancel(event) {
  hideNeighborhoodHover()

  currentlyTouching = false
}

function addTouchEventHandlers() {
  document.body.addEventListener('touchstart', onBodyTouchStart, false)
  document.body.addEventListener('touchmove', onBodyTouchMove, false)
  document.body.addEventListener('touchend', onBodyTouchEnd, false)
  document.body.addEventListener('touchcancel', onBodyTouchCancel, false)
}

function determineLanguage() {
  if (CITY_DATA[cityId].languages) {
    for (var name in CITY_DATA[cityId].languages) {
      defaultLanguage = name
      break
    }

    for (var name in CITY_DATA[cityId].languages) {
      if ((name != defaultLanguage) && 
          (window.localStorage['prefer-' + name + '-to-' + defaultLanguage] === 'yes')) {
        language = name
        return
      }
    }
    language = defaultLanguage
  }
}

function everythingLoaded() {
  if (!mainMenu) {
    calculateMapSize()
    prepareMapBackground()

    prepareNeighborhoods()
    updateNeighborhoodDisplayNames()

    createMap()

    addTouchEventHandlers()

    startIntro()
  }
}

function onGeoDataLoad(data) {
  geoDataLoaded = true
  geoData = JSON.parse(this.responseText)
  
  checkIfEverythingLoaded()
}

function updateLanguagesSelector() {
  var els = document.querySelectorAll('header .languages button.selected')
  for (var i = 0, el; el = els[i]; i++) {
    el.classList.remove('selected')
  }

  var el = document.querySelector('header .languages button[name="' + language + '"]')
  el && el.classList.add('selected')
}

function sanitizeName(name) {
  name = name.replace(/[\n\r]/g, '')
  return name
}

function updateNeighborhoodDisplayNames() {
  neighborhoodsDisplayNames = {}

  for (var i in geoData.features) {
    var name = sanitizeName(geoData.features[i].properties.name)

    if (CITY_DATA[cityId].languages) {
      var id = CITY_DATA[cityId].languages[language]
    } else {
      var id = 'name'
    }

    neighborhoodsDisplayNames[name] = geoData.features[i].properties[id]
  }  
}

function prepareNeighborhoods() {
  neighborhoods = []

  for (var i in geoData.features) {
    var name = sanitizeName(geoData.features[i].properties.name)

    neighborhoods.push(name)
  }

  totalNeighborhoodsCount = neighborhoods.length
}

function createMainMenuMap() {
  // TODO temporarily remove until we fix positioning (issue #156)
  return

  var features = []

  for (var i in CITY_DATA) {
    var cityData = CITY_DATA[i]

    var feature = {}
    feature.type = 'Feature'
    feature.properties = { id: i }
    feature.geometry = { type: 'Point', coordinates: cityData.sampleLatLon } 

    features.push(feature)
  }

  if (currentGeoLat) {
    var feature = {}
    feature.type = 'Feature'
    feature.properties = { id: i, current: true }
    feature.geometry = { type: 'Point', coordinates: [currentGeoLon, currentGeoLat] } 

    features.push(feature)    
  }

  mapSvg
    .selectAll('.location')
    .data(features)
    .enter()
    .append('path')
    .attr('d', geoMapPath.pointRadius(1))
    .attr('city-id', function(d) { return d.properties.id })
    .attr('class', function(d) { 
      var name = 'location'
      if (d.properties.current) {
        name += ' current'
      }
      return name
    })
}

function animateMainMenuCity(event) {
  var el = event.target
  while (!el.getAttribute('city-id')) {
    el = el.parentNode
  }
  var id = el.getAttribute('city-id')

  mapSvg
    .select('#map .location[city-id="' + id + '"]')
    .transition()
    .duration(2000)
    .attr('d', geoMapPath.pointRadius(1000))
    .style('opacity', 0)
    .style('fill-opacity', 0)

  document.querySelector('header.main-menu').classList.add('hidden')
}

function restoreMainMenuCity(event) {
  var el = event.target
  while (!el.getAttribute('city-id')) {
    el = el.parentNode
  }
  var id = el.getAttribute('city-id')

  mapSvg
    .select('#map .location[city-id="' + id + '"]')
    .transition()
    .duration(150)
    .attr('d', geoMapPath.pointRadius(1))
    .style('opacity', 1)
    .style('fill-opacity', .1)

  document.querySelector('header.main-menu').classList.remove('hidden')
}

function setTouchActive(newTouchActive) {
  touchActive = newTouchActive

  if (touchActive) {
    document.body.classList.add('touch-active')
  } else {
    document.body.classList.remove('touch-active')    
  }

  var els = document.querySelectorAll('.click-verb')
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = touchActive ? 'touch' : 'click'
  }
}

function getTooltipName(neighborhoodEl, correct) {
  if (correct) {
    var name = neighborhoodsDisplayNames[neighborhoodToBeGuessedNext]

    if (CITY_DATA[cityId].extraData) { 
      var geoDatum

      for (var i in geoData.features) {
        if (geoData.features[i].properties['name'] == name) {
          geoDatum = geoData.features[i]
          break
        }
      }

      if (geoDatum) {
        name += '<div class="extra-data">'

        for (var i in CITY_DATA[cityId].extraData) {
          var id = CITY_DATA[cityId].extraData[i]

          name += '<br>' + geoDatum.properties[id]
        }
        name += '</div>'
      }
    }    

    return name
  } else {
    if (neighborhoodEl.getAttribute('names')) {
      var names = JSON.parse(neighborhoodEl.getAttribute('names'))
      var tooltip = ''

      if (names.indexOf(neighborhoodToBeGuessedNext) != -1) {
        tooltip += neighborhoodsDisplayNames[neighborhoodToBeGuessedNext] + ' + '
      }

      for (var i in names) {
        if (neighborhoodToBeGuessedNext != names[i]) {
          tooltip += neighborhoodsDisplayNames[names[i]] + ' + '
        }
      }
      tooltip = tooltip.substr(0, tooltip.length - 3)
      return tooltip
    } else {
      var name = neighborhoodEl.getAttribute('name')
      return neighborhoodsDisplayNames[name]
    }
  }
}

function showNeighborhoodTooltip(neighborhoodEl, hoverEl, correct) {
  if ((hoverEl.innerHTML == getTooltipName(neighborhoodEl, correct)) && 
      (hoverEl.classList.contains('visible'))) {
    return
  }

  hoverEl.classList.remove('visible')
  hoverEl.innerHTML = getTooltipName(neighborhoodEl, correct)

  var boundingBox = neighborhoodEl.getBoundingClientRect()

  if (touchActive) {
    var top = boundingBox.top - hoverEl.offsetHeight - 30
  } else {
    var top = boundingBox.top + boundingBox.height
  }

  var left = (boundingBox.left + boundingBox.width / 2 - hoverEl.offsetWidth / 2)

  hoverEl.style.top = top + 'px' 
  hoverEl.style.left = left + 'px'

  if (neighborhoodEl.getAttribute('inactive')) {
    hoverEl.classList.add('inactive')
  } else {
    hoverEl.classList.remove('inactive')
  }

  hoverEl.classList.add('visible')  
}

function hoverNeighborhoodEl(neighborhoodEl, showTooltip) {
  var hoverEl = document.querySelector('#neighborhood-hover')

  var name = neighborhoodEl.getAttribute('name')

  if (showTooltip) {
    showNeighborhoodTooltip(neighborhoodEl, hoverEl, false)
  }
}

function hideNeighborhoodHover() {
  document.querySelector('#neighborhood-hover').classList.remove('visible')
}

function createMap() {
  var mapContents = mapSvg
    .selectAll('path')
    .data(geoData.features)
    .enter()
    .append('path')
    .attr('class', 'neighborhood unguessed')
    .attr('name', function(d) { return sanitizeName(d.properties.name) })
    .on('click', function(d) {
      var el = d3.event.target || d3.event.toElement

      onNeighborhoodClick(el)
    })
    .on('mousedown', function(d) {
      setTouchActive(false)

      d3.event.preventDefault()
    })
    .on('mouseover', function(d) {
      if (!touchActive) {
        var el = d3.event.target || d3.event.toElement
        hoverNeighborhoodEl(el, true)

        el.classList.add('hover')
      }
    })
    .on('mouseout', function(d) {
      if (!touchActive) {
        var el = d3.event.target || d3.event.toElement

        el.classList.remove('hover')
      }
      hideNeighborhoodHover()
    })

  onResize()
}

function removePaddedIslandNeighborhoods() {
  var els = document.querySelectorAll('#svg-container .unpadded')
  for (var i = 0, el; el = els[i]; i++) {
    el.parentNode.removeChild(el)
  }

  var els = document.querySelectorAll('#svg-container .padded')
  for (var i = 0, el; el = els[i]; i++) {
    el.classList.remove('padded')
  }
}

function addPaddedIslandNeighborhoods() {
  if (mainMenu || CITY_DATA[cityId].pointsInsteadOfPolygons) {
    return
  }

  var els = document.querySelectorAll('#svg-container .neighborhood')
  for (var i = 0, el; el = els[i]; i++) {
    var name = el.getAttribute('name')
    if (smallNeighborhoodsRemoved.indexOf(name) != -1) {
      continue
    }

    var boundingBox = el.getBBox()
    var boundingBoxArea = boundingBox.width * boundingBox.height

    var segs = splitPathIntoSeparateSegments(el)
    var area = 0
    for (var j in segs) {
      var seg = segs[j]
      area += getPolygonArea(pathToPolygon(seg))
    }


    // TODO const
    var needsPadding = (area < 100) && ((area / boundingBoxArea) < .35)

    if (needsPadding) {
      var secondEl = el.cloneNode(true)
      el.parentNode.appendChild(secondEl)
      el.classList.add('padded')
      secondEl.classList.add('unpadded')
    }
  }
}

function setMapClickable(newMapClickable) {
  mapClickable = newMapClickable

  if (mapClickable) {
    document.body.classList.remove('no-hover')
  } else {
    document.body.classList.add('no-hover')    
  }
}

function animateCorrectNeighborhoodGuess(el) {
  var animEl = el.cloneNode(true)

  animEl.classList.remove('hover')
  animEl.classList.remove('guessed')

  if (el.getAttribute('transformX')) {
    var radius = getPointRadius()
    var x = parseFloat(el.getAttribute('transformX')) + radius / 2
    var y = parseFloat(el.getAttribute('transformY')) + radius / 2
    animEl.style.transform = 'translate(' + x + 'px, ' + y + 'px)'
    animEl.style.MozTransform = 'translate(' + x + 'px, ' + y + 'px)'
    animEl.style.webkitTransform = 'translate(' + x + 'px, ' + y + 'px)'
    window.setTimeout(function() {
      animEl.classList.add('animate')

      animEl.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(6)'
      animEl.style.MozTransform = 'translate(' + x + 'px, ' + y + 'px) scale(6)'
      animEl.style.webkitTransform = 'translate(' + x + 'px, ' + y + 'px) scale(6)'
    }, 50)    
  } else {
    window.setTimeout(function() {
      animEl.classList.add('animate')
    }, 50)    
  }
    
  el.parentNode.appendChild(animEl)
  animEl.classList.add('guessed-animation')

  //animEl.style.outline = '3px solid red'

  window.setTimeout(function() { 
    animEl.parentNode.removeChild(animEl) 
  }, REMOVE_NEIGHBORHOOD_ANIMATE_GUESS_DELAY)
}

function getHighlightableNeighborhoodEl(name) {
  var els = document.querySelectorAll('#map svg :not(.unpadded)')
  for (var i = 0, el; el = els[i]; i++) {
    if (el.getAttribute('composited')) {
      var names = JSON.parse(el.getAttribute('names'))
      if (names.indexOf(name) != -1) {
        return el
      }
    } else {
      if (el.getAttribute('name') == name) {
        return el
      }
    }
  }
}

function updateGuessedAndInactiveStates() {
  var els = document.querySelectorAll('#map .neighborhood')

  for (var i = 0, el; el = els[i]; i++) {
    var allGuessed = true
    var someActive = false

    if (el.getAttribute('composited')) {
      var names = JSON.parse(el.getAttribute('names'))
      for (var j in names) {
        var name = names[j]
        if ((neighborhoodsGuessed.indexOf(name) == -1) && (neighborhoodsToBeGuessed.indexOf(name) != -1)) {
          allGuessed = false
        }
        if ((neighborhoodsGuessed.indexOf(name) != -1) || (neighborhoodsToBeGuessed.indexOf(name) != -1)) {
          someActive = true
        }

      }
    } else {
      var name = el.getAttribute('name')

      if ((neighborhoodsGuessed.indexOf(name) == -1) && (neighborhoodsToBeGuessed.indexOf(name) != -1)) {
        allGuessed = false
      }
      if ((neighborhoodsGuessed.indexOf(name) != -1) || (neighborhoodsToBeGuessed.indexOf(name) != -1)) {
        someActive = true
      }
    }

    if (allGuessed && someActive) {
      el.classList.remove('unguessed')
      el.classList.add('guessed')
    } else {
      el.classList.remove('guessed')
      el.classList.add('unguessed')      
    }

    if (someActive) {
      el.removeAttribute('inactive')
    } else {
      el.setAttribute('inactive', true)
    }

  }
}

function onNeighborhoodClick(el) {
  if (!mapClickable || el.getAttribute('inactive')) {      
    return
  }

  setMapClickable(false)

  if (el.getAttribute('composited')) {
    var name = neighborhoodToBeGuessedNext
    var names = JSON.parse(el.getAttribute('names'))

    var guessed = names.indexOf(neighborhoodToBeGuessedNext) != -1
  } else {
    var name = el.getAttribute('name')
    var el = getHighlightableNeighborhoodEl(name)

    var guessed = (name == neighborhoodToBeGuessedNext)
  }

  var time = new Date().getTime() - currentNeighborhoodStartTime

  if (guessed) {
    if (time > TOOLTIP_DELAY_THRESHOLD) {
      currentTooltipDelay -= time - TOOLTIP_DELAY_THRESHOLD
      if (currentTooltipDelay < 0) {
        currentTooltipDelay = 0
      }
    } else {
      currentTooltipDelay += TOOLTIP_INCREMENT
      if (currentTooltipDelay > MAX_TOOLTIP_DELAY) {
        currentTooltipDelay = MAX_TOOLTIP_DELAY
      }
    }

    if (CITY_DATA[cityId].extraData) { 
      var correctEl = getHighlightableNeighborhoodEl(neighborhoodToBeGuessedNext)
      var correctNameEl = document.querySelector('#neighborhood-correct-name')
      showNeighborhoodTooltip(correctEl, correctNameEl, true)    
      window.setTimeout(removeNeighborhoodHighlights, HIGHLIGHT_DELAY)
    }

    neighborhoodsGuessed.push(name)
    neighborhoodsToBeGuessed.splice(neighborhoodsToBeGuessed.indexOf(name), 1)

    animateCorrectNeighborhoodGuess(el)

    updateGuessedAndInactiveStates()
    updateGameProgress()

    if (neighborhoodsToBeGuessed.length == 0) {
      gameOver()
    } else {
      window.setTimeout(nextGuess, NEXT_GUESS_DELAY)
    }
  } else {
    // Incorrect

    currentTooltipDelay -= 1000
    if (currentTooltipDelay < 0) {
      currentTooltipDelay = 0
    }

    el.classList.remove('unguessed')
    el.classList.add('wrong-guess')

    var correctEl = getHighlightableNeighborhoodEl(neighborhoodToBeGuessedNext)
    correctEl.classList.add('right-guess')

    var correctNameEl = document.querySelector('#neighborhood-correct-name')
    showNeighborhoodTooltip(correctEl, correctNameEl, true)

    window.setTimeout(removeNeighborhoodHighlights, HIGHLIGHT_DELAY)
    window.setTimeout(nextGuess, HIGHLIGHT_DELAY + NEXT_GUESS_DELAY)
  }

  neighborhoodToBeGuessedLast = neighborhoodToBeGuessedNext
  neighborhoodToBeGuessedNext = ''
  updateNeighborhoodDisplay()
}

function updateGameProgress() {
  document.querySelector('#count').innerHTML = 
      neighborhoodsGuessed.length + ' of ' + 
      (neighborhoodsGuessed.length + neighborhoodsToBeGuessed.length)

  document.querySelector('#count-time-wrapper-wrapper').classList.add('visible')
}

function removeNeighborhoodHighlights() {
  var el = document.querySelector('#map svg .wrong-guess')
  if (el) {
    el.classList.remove('wrong-guess')
    el.classList.add('unguessed')
  }
  var el = document.querySelector('#map svg .right-guess')
  if (el) {
    el.classList.remove('right-guess')
    el.classList.add('unguessed')
  }

  var el = document.querySelector('#neighborhood-correct-name')
  if (el) {
    el.classList.remove('visible')
  }
}

function updateNeighborhoodDisplayName() {
  document.querySelector('#neighborhood-guess .name').innerHTML = 
    neighborhoodsDisplayNames[neighborhoodToBeGuessedNext]  
}

function updateNeighborhoodDisplay() {
  if (neighborhoodToBeGuessedNext) {
    updateNeighborhoodDisplayName()

    document.querySelector('#neighborhood-guess-wrapper').classList.add('visible')  
  } else {
    document.querySelector('#neighborhood-guess-wrapper').classList.remove('visible')      
    document.querySelector('#neighborhood-guess-wrapper').classList.add('invisible')  

    window.setTimeout(function() {
      document.querySelector('#neighborhood-guess-wrapper').classList.remove('invisible')
    }, 150)
  }

}

function nextGuess() {
  setMapClickable(true)

  currentNeighborhoodStartTime = new Date().getTime()
  currentNeighborhoodOverThreshold = false
  hideTooltips()

  do {
    var pos = Math.floor(Math.random() * neighborhoodsToBeGuessed.length)
    neighborhoodToBeGuessedNext = neighborhoodsToBeGuessed[pos]

    //neighborhoodToBeGuessedNext = 'Tottenham Court Road'
    // DEBUG

    /*if (neighborhoodsGuessed.length == 0) {
      neighborhoodToBeGuessedNext = 'Regents Park'
      neighborhoodToBeGuessedLast = ''
    } else if (neighborhoodsGuessed.length == 1) {
      neighborhoodToBeGuessedNext = 'Great Portland Street'
      neighborhoodToBeGuessedLast = ''
    }*/
    
  } while ((neighborhoodToBeGuessedLast == neighborhoodToBeGuessedNext) &&
           (neighborhoodsToBeGuessed.length > 1))
  updateNeighborhoodDisplay()
}

function startIntro() {
  document.querySelector('#loading').classList.remove('visible')
  document.querySelector('#select-mode').classList.add('visible')
}

/*function makeAllNeighborhoodsActive() {
  var els = document.querySelectorAll('#map svg [inactive]')

  for (var i = 0, el; el = els[i]; i++) {
    el.removeAttribute('inactive')
  } 
}*/

/*function makeNeighborhoodInactive(name) {
  var el = getHighlightableNeighborhoodEl(name)

  el.setAttribute('inactive', true)
}*/

function makeNeighborhoodsInactiveForEasyMode() {
  while (neighborhoodsToBeGuessed.length > EASY_MODE_COUNT) {
    var pos = Math.floor(Math.random() * neighborhoodsToBeGuessed.length)

    var name = neighborhoodsToBeGuessed[pos]

    //makeNeighborhoodInactive(name)

    neighborhoodsToBeGuessed.splice(pos, 1)
  }

  updateGuessedAndInactiveStates()
}

function reloadPage() {
  location.reload()
}

function startGame(useEasyMode) {
  gameStarted = true

  document.querySelector('#intro').classList.remove('visible')  
  document.querySelector('#select-mode').classList.remove('visible')  
  document.querySelector('#cover').classList.remove('visible')

  neighborhoodsToBeGuessed = []
  for (var i in neighborhoods) {
    neighborhoodsToBeGuessed.push(neighborhoods[i])
  }

  easyMode = useEasyMode
  if (easyMode) {
    makeNeighborhoodsInactiveForEasyMode()
  }

  updateGameProgress()

  startTime = new Date().getTime()
  updateTimer()
  
  window.setTimeout(function() {
    startTime = new Date().getTime()
    timerIntervalId = window.setInterval(updateTimer, 100)
  }, NEXT_GUESS_DELAY)

  window.setTimeout(nextGuess, NEXT_GUESS_DELAY)
}

function createTimeout(fn, data, delay) {
  window.setTimeout(function() { fn.call(null, data) }, delay)
}

function stopTimer() {
  timerStopped = true
  finalTime = new Date().getTime()
  window.clearInterval(timerIntervalId)  

  updateTimer()
}

function gameOver() {
  stopTimer()

  setMapClickable(false)
  var els = document.querySelectorAll('#map .guessed')

  // TODO constants
  var timer = 300
  var timerDelta = 100
  var timerDeltaDiff = 5
  var TIMER_DELTA_MIN = 10 

  for (var i = 0, el; el = els[i]; i++) {
    createTimeout(function(el) { animateCorrectNeighborhoodGuess(el) }, el, timer)

    timer += timerDelta
    timerDelta -= timerDeltaDiff
    if (timerDelta < TIMER_DELTA_MIN) {
      timerDelta = TIMER_DELTA_MIN
    }
  }

  // TODO constants
  window.setTimeout(gameOverPart2, timer + 1000)
}

function getSharingMessage() {
  return 'I just played Click That ’Hood and identified ' + 
      neighborhoodsGuessed.length + ' ' + CITY_DATA[cityId].locationName + ' ' + 
      getNeighborhoodNoun(true) + ' in ' + getTimer() + '. Try to beat me!'
}

function updateFacebookLink(congratsEl) {
  var el = congratsEl.querySelector('#share-via-facebook')

  var text = getSharingMessage()
  var url = location.href

  el.href = 'https://www.facebook.com/dialog/feed?' +
      'app_id=' + FACEBOOK_APP_ID +
      '&redirect_uri=' + encodeURIComponent(url) + 
      '&link=' + encodeURIComponent(url) + 
      '&name=' + encodeURIComponent('Click That ’Hood') +
      '&description=' + encodeURIComponent(text)
}

function updateTwitterLink(congratsEl) {
  var el = congratsEl.querySelector('#share-via-twitter')

  var text = getSharingMessage()
  var url = location.href

  el.href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + 
      '&url=' + encodeURIComponent(url)
}

function gameOverPart2() {
  var el = document.querySelector('#congrats')
  document.querySelector('#number-identified').innerHTML = 
      easyMode ? easyModeCount : 'all'
      
  document.querySelector('#count-time-wrapper-wrapper').classList.remove('visible')
  document.querySelector('#more-cities-wrapper-wrapper').classList.add('visible')

  updateTwitterLink(el)
  updateFacebookLink(el)

  document.querySelector('#cover').classList.add('visible')
  el.classList.add('visible')  
}

function getTimer() {
  if (!timerStopped) {
    var time = new Date().getTime()
  } else {
    var time = finalTime
  }

  var elapsedTime = Math.floor((time - startTime) / 100)

  var tenthsOfSeconds = elapsedTime % 10

  var seconds = Math.floor(elapsedTime / 10) % 60
  if (seconds < 10) {
    seconds = '0' + seconds
  }

  var minutes = Math.floor(elapsedTime / 600)

  return minutes + ':' + seconds + '.' + tenthsOfSeconds
}

function hideTooltips() {
  document.querySelector('#neighborhood-hover').classList.remove('active')
}

function showTooltips() {
  document.querySelector('#neighborhood-hover').classList.add('active')
}

function updateTimer() {
  var timeHtml = getTimer()

  var els = document.querySelectorAll('.time')
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = timeHtml
  } 

  if (!currentNeighborhoodOverThreshold) {
    var time = new Date().getTime() - currentNeighborhoodStartTime

    if (time > currentTooltipDelay) {
      currentNeighborhoodOverThreshold = true
      showTooltips()
    }
  }
}

function prepareMapBackground() {
  if (!geoDataLoaded) {
    return
  }

  updateCanvasSize()

  // TODO this is the worst line of code ever written
  var size = globalScale * .0012238683395795992 * .995 / 2 * .800 / 2 / 4

  var zoom = MAP_BACKGROUND_DEFAULT_ZOOM + 2

  while (size < MAP_BACKGROUND_SIZE_THRESHOLD) {
    size *= 2
    zoom--
  } 

  // TODO resize properly instead of recreating every single time
  document.querySelector('#maps-background').innerHTML = ''

  if (typeof mapbox != 'undefined') {
    var layer = mapbox.layer().id(MAPBOX_MAP_ID)
    var map = 
        mapbox.map(document.querySelector('#maps-background'), layer, null, [])

    if (pixelRatio == 2) {
      zoom++
    }

    // US cities have states and no country, but some world cities have states
    // yet also want to match all US national maps which have no states
    if ((CITY_DATA[cityId].stateName && !CITY_DATA[cityId].countryName) ||
        (CITY_DATA[cityId].countryName && CITY_DATA[cityId].countryName == COUNTRY_NAME_USA)) {
      var maxZoomLevel = MAP_BACKGROUND_MAX_ZOOM_US
    } else {
      var maxZoomLevel = MAP_BACKGROUND_MAX_ZOOM_NON_US
    }
    while (zoom > maxZoomLevel) {
      zoom--
      size *= 2
    }

    map.tileSize = { x: Math.round(size / pixelRatio), 
                     y: Math.round(size / pixelRatio) }

    var tile = latToTile(centerLat, zoom)
    var longStep = 
        (tileToLon(1, zoom) - tileToLon(0, zoom)) / 256 * 128
    var latStep = 
        (tileToLat(tile + 1, zoom) - tileToLat(tile, zoom)) / 256 * 128

    var lat = centerLat
    var lon = centerLon

    var leftMargin = BODY_MARGIN * 2 + HEADER_WIDTH

    var ratio = leftMargin / map.tileSize.x

    lon -= ratio * longStep

    map.centerzoom({ lat: lat, lon: lon }, zoom)
  }
}

function onResize() {
  var height = mainMenu ? MAIN_MENU_HEIGHT : window.innerHeight

  document.querySelector('body > .canvas').style.height = 
    (height - document.querySelector('body > .canvas').offsetTop) + 'px'

  if (mainMenu) {
    calculateMapSize()

    // TODO temporarily remove until we fix positioning (issue #156)
    document.body.classList.add('no-fixed-main-menu')
    /*if (window.innerHeight > MAIN_MENU_MIN_FIXED_HEIGHT) {
      document.body.classList.remove('no-fixed-main-menu')
    } else {
      document.body.classList.add('no-fixed-main-menu')
    }*/
  } else {
    if (geoDataLoaded) {
      calculateMapSize()
      prepareMapBackground()

      removePaddedIslandNeighborhoods()
      removeAutomaticallyPointedNeighborhoods()
      removeCompositePoints()

      mapSvg.attr('width', mapWidth)
      mapSvg.attr('height', mapHeight)
      if (CITY_DATA[cityId].pointsInsteadOfPolygons) {
        var radius = getPointRadius()

        mapSvg.selectAll('path')
          .attr('d', d3.svg.symbol().type('square').size(radius * radius))
          .attr('point', true)
          .attr('transformX', function(d) { return projection(d.geometry.coordinates)[0] - radius / 2 })
          .attr('transformY', function(d) { return projection(d.geometry.coordinates)[1] - radius / 2 })
          .attr('transform', function(d) { 
            return "translate(" + projection(d.geometry.coordinates)[0] + "," + 
                projection(d.geometry.coordinates)[1] + ")" 
          })
      } else {
        mapSvg.selectAll('path').attr('d', geoMapPath)
      }

      if (!gameStarted) {
        prepareNeighborhoods()
        
      } else {
        updateGuessedAndInactiveStates()
      }
      
      removeSmallNeighborhoods() 
      updateCount()

      addCompositePoints()

      addPaddedIslandNeighborhoods()
    }
  }
}

function getCityId() {
  var finalSlash = location.href.lastIndexOf('/')
  var cityMatch = location.href.substr(finalSlash + 1)

  if (cityMatch.length > 0) {
    if (CITY_DATA[cityMatch]) {
      cityId = cityMatch
    }
  }      

  if (!cityId) {
    mainMenu = true
  }
}

function updateFooter() {
  if (CITY_DATA[cityId].dataUrl) {
    document.querySelector('footer .data-source a').href = 
        CITY_DATA[cityId].dataUrl
    document.querySelector('footer .data-source a').innerHTML = 
        CITY_DATA[cityId].dataTitle
    document.querySelector('footer .data-source').classList.add('visible')
  }

  if (CITY_DATA[cityId].authorTwitter) {
    document.querySelector('footer .author a').href = 
        'http://twitter.com/' + CITY_DATA[cityId].authorTwitter
    document.querySelector('footer .author a').innerHTML = 
        '@' + CITY_DATA[cityId].authorTwitter
    document.querySelector('footer .author').classList.add('visible')
  } 
}

function resizeLogoIfNecessary() {
  var headerEl = document.querySelector('.canvas > header')
  var el = document.querySelector('.canvas > header .location-name')

  var ratio = el.offsetWidth / headerEl.offsetWidth

  if (ratio > 1) {
    var el = document.querySelector('.canvas > header .names')

    // TODO const
    el.querySelector('.location-name').style.fontSize = (48 / ratio) + 'px'
    el.querySelector('.state-or-country').style.fontSize = (42 / ratio) + 'px'
  }
}

function getNeighborhoodNoun(plural) {
  if (!plural) {
    return (CITY_DATA[cityId].neighborhoodNoun && CITY_DATA[cityId].neighborhoodNoun[0]) || DEFAULT_NEIGHBORHOOD_NOUN_SINGULAR
  } else { 
    return (CITY_DATA[cityId].neighborhoodNoun && CITY_DATA[cityId].neighborhoodNoun[1]) || DEFAULT_NEIGHBORHOOD_NOUN_PLURAL
  }
}

function preparePage() {
  var inUnitedStates = 
    !CITY_DATA[cityId].countryName ||
    (CITY_DATA[cityId].countryName == COUNTRY_NAME_USA)

  var stateName = CITY_DATA[cityId].stateName
  if (inUnitedStates && US_AP_STATE_NAMES[stateName]) {
    stateName = US_AP_STATE_NAMES[stateName]
  }
  
  var name = stateName || CITY_DATA[cityId].countryName || ''

  // TODO don’t hardcode!
  if (!name || (name == COUNTRY_NAME_USA) || (name == CITY_DATA[cityId].locationName) || 
      ((name == 'U.K.') && (CITY_DATA[cityId].locationName == 'United Kingdom'))) {
    name = ''
    document.querySelector('header .location-name').classList.add('no-state-or-country')
  } else {
    document.querySelector('header .location-name').classList.remove('no-state-or-country')    
  }
  document.querySelector('header .state-or-country').innerHTML = name

  document.querySelector('header .annotation').innerHTML = 
      CITY_DATA[cityId].annotation || ''

  var els = document.querySelectorAll('.location-name')
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = CITY_DATA[cityId].locationName
  }

  var neighborhoodNoun = getNeighborhoodNoun(false)
  var els = document.querySelectorAll('.neighborhood-noun')
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = neighborhoodNoun
  }

  var neighborhoodNounPlural = getNeighborhoodNoun(true)
  var els = document.querySelectorAll('.neighborhood-nouns')
  for (var i = 0, el; el = els[i]; i++) {
    el.innerHTML = neighborhoodNounPlural
  }

  if (CITY_DATA[cityId].languages) {
    for (var name in CITY_DATA[cityId].languages) {
      var buttonEl = document.createElement('button')
      buttonEl.innerHTML = name
      buttonEl.setAttribute('name', name)

      buttonEl.addEventListener('click', languageChange)

      document.querySelector('header .languages').appendChild(buttonEl)
    }
  }

  resizeLogoIfNecessary()
}

function languageChange(event) {
  var el = event.target

  var newLanguage = event.target.getAttribute('name')
  if (language == newLanguage) {
    return
  }

  if (language != defaultLanguage) {
    delete window.localStorage['prefer-' + language + '-to-' + defaultLanguage]
  }

  if (newLanguage != defaultLanguage) {
    window.localStorage['prefer-' + newLanguage + '-to-' + defaultLanguage] = 'yes'
  }

  language = newLanguage

  updateLanguagesSelector()
  updateNeighborhoodDisplayNames()
  updateNeighborhoodDisplayName()
  updateSmallNeighborhoodDisplay()
}

function prepareLocationList() {
  var ids = []
  for (var id in CITY_DATA) {
    ids.push(id)
  }

  ids.sort(function(a, b) {
    return (CITY_DATA[a].longLocationName || CITY_DATA[a].locationName) >
        (CITY_DATA[b].longLocationName || CITY_DATA[b].locationName) ? 1 : -1
  })

  // filter list of sorted cities into countries
  var countryCities = {}
  for (var countryId in COUNTRY_NAMES) {
    countryCities[COUNTRY_NAMES[countryId]] = []
  }

  for (var id in ids) {
    var city = ids[id]
    var country = CITY_DATA[city].countryName

    if (country) {
      countryCities[country].push(city)
    } else if (CITY_DATA[city].stateName) {
      countryCities[COUNTRY_NAME_USA].push(city)
    } else {
      countryCities[COUNTRY_NAME_WORLD].push(city)
    }
  }
  
  for (var i in COUNTRY_NAMES) {
    var el = document.createElement('h1')
    el.innerHTML = COUNTRY_NAMES[i]
    document.querySelector('.menu .locations').appendChild(el)

    // already did the work of filtering list of cities above
    var cities = countryCities[COUNTRY_NAMES[i]]
    for (var j in cities) {
      var id = cities[j]
      var cityData = CITY_DATA[id]

      var el = document.createElement('li')

      el.setAttribute('city-id', id)

      var html = '<a href="' + id + '">'

      html += cityData.longLocationName || cityData.locationName
      if (cityData.annotation) {
        html += '<span class="annotation">' + cityData.annotation + '</span>'
      }
      html += '</a>'
      el.innerHTML = html

      // TODO temporarily remove until we fix positioning (issue #156)
      // el.querySelector('a').addEventListener('mouseover', animateMainMenuCity, false)
      // el.querySelector('a').addEventListener('mouseout', restoreMainMenuCity, false)

      document.querySelector('.menu .locations').appendChild(el)
    }
  }

  var el = document.createElement('h1')
  el.innerHTML = ''
  document.querySelector('.menu .locations').appendChild(el)

  var el = document.createElement('li')
  el.innerHTML = '<a target="_blank" class="add-your-city" href="' + 
      ADD_YOUR_CITY_URL + '">Add your city…</a>'
  document.querySelector('.menu .locations').appendChild(el)

  if (cityId) {
    var el = document.querySelector('li[city-id="' + cityId + '"]')
    el.classList.add('selected')
  }
}

function prepareMainMenu() {
  document.body.classList.add('main-menu')
}

function getEnvironmentInfo() {
  setTouchActive(Modernizr.touch)
  pixelRatio = window.devicePixelRatio || 1

  if (touchActive) {
    smallNeighborhoodThreshold = SMALL_NEIGHBORHOOD_THRESHOLD_TOUCH
  } else {
    smallNeighborhoodThreshold = SMALL_NEIGHBORHOOD_THRESHOLD_MOUSE
  }
}

function removeHttpsIfPresent() {
  // Gets out of HTTPS to do HTTP, because D3 doesn’t allow linking via 
  // HTTPS. But there’s a better way to deal with all of this, I feel
  // (hosting our own copy of D3?).
  if (location.protocol == 'https:') {
    location.replace(location.href.replace(/https:\/\//, 'http://'))
  }
}

function checkIfEverythingLoaded() {
  if ((geoDataLoaded || mainMenu) && bodyLoaded) {
    everythingLoaded()
  }
}

function onBodyLoad() {
  bodyLoaded = true
  checkIfEverythingLoaded()
}

function deg2rad(deg) {
  return deg * (Math.PI / 180)
}

function geoDist(lat1, lon1, lat2, lon2) {
  var R = 6371 // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1)
  var dLon = deg2rad(lon2 - lon1) 
  var a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2) 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) 
  var d = R * c // distance in km
  return d
}

function receiveGeolocation(position) {
  currentGeoLat = position.coords.latitude
  currentGeoLon = position.coords.longitude

  for (var id in CITY_DATA) {
    var cityData = CITY_DATA[id]

    var cityLat = cityData.sampleLatLon[1]
    var cityLon = cityData.sampleLatLon[0]

    var dist = geoDist(cityLat, cityLon, currentGeoLat, currentGeoLon)

    // TODO const
    if (dist < 150) {
      var el = document.querySelector('li[city-id="' + id + '"]')
      el.classList.add('nearby')
    }
  }

  if (mainMenu) {
    createMainMenuMap()
  }
}

function prepareGeolocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(receiveGeolocation)
  }
}

function onMoreCitiesClick() {
  document.body.scrollTop = window.innerHeight
}

function testBrowser() {
  var goodEnoughBrowser = document.body.classList

  if (!goodEnoughBrowser) {
    document.getElementById('wrong-browser').className += ' visible'

    return goodEnoughBrowser
  }

  var mobile = window.matchMedia && window.matchMedia('(max-device-width: 568px)').matches

  if (mobile) {
    document.getElementById('mobile').className += ' visible'
    document.querySelector('#mobile button').addEventListener('click', ignoreMobileBrowserWarning)
  }

  return !mobile
}

function ignoreMobileBrowserWarning() {
  document.getElementById('mobile').className = ''
  browserIsOkay()
}

function browserIsOkay() {
  window.addEventListener('load', onBodyLoad, false)
  window.addEventListener('resize', onResize, false)

  document.querySelector('#more-cities-wrapper div').
      addEventListener('click', onMoreCitiesClick, false)

  getEnvironmentInfo()
  getCityId()

  prepareLocationList()
  prepareGeolocation()

  onResize()

  if (mainMenu) {
    prepareMainMenu()
    prepareMainMenuMapBackground()

    createSvg()
    calculateMapSize()
    createMainMenuMap()
  } else {
    document.querySelector('#cover').classList.add('visible')
    document.querySelector('#loading').classList.add('visible')
    document.querySelector('#intro').classList.add('visible')

    determineLanguage()
    preparePage()
    updateLanguagesSelector()
    updateFooter()
    createSvg()
    loadGeoData()
  }

  onResize()
}

function main() {
  removeHttpsIfPresent()

  if (testBrowser()) {
    browserIsOkay()
  }
}
