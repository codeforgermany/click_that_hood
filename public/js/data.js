// TODO re-sort by addition, sort by name automatically
var CITY_DATA = {
  'chicago': {
    // TODO unhardcode this
    mapSize: [ 2500, 3850 ],
    stateName: 'Ill.',
    optDataFile: 'data/chicago.geojson',
    googleMapsQuery: 'Chicago, IL',
    dataUrl: 'https://data.cityofchicago.org/Facilities-Geographic-Boundaries/Boundaries-Neighborhoods/9wp7-iasj',
    dataTitle: 'City of Chicago Data Portal'
  },
  'lexington': { 
    mapSize: [ 1507, 1507 ],
    stateName: 'Ky.',
    googleMapsQuery: 'Lexington, KY',
    dataUrl: 'http://www.zillow.com/howto/api/neighborhood-boundaries.htm',
    dataTitle: 'Zillow'
  },
  'louisville': {
    mapSize: [ 1507, 1196 ],
    stateName: 'Ky.',
    googleMapsQuery: 'Louisville, KY',
    dataUrl: 'http://www.zillow.com/howto/api/neighborhood-boundaries.htm',
    dataTitle: 'Zillow'
  },
  'macon': {
    mapSize: [ 1507, 1196 ],
    stateName: 'Ga.',
    author: 'mapmeld',
    optDataFile: 'data/macon.geojson',
    googleMapsQuery: 'Macon, GA',
    dataUrl: 'http://datahub.io/dataset/macon-neighborhoods',
    dataTitle: 'Macon Police Dept'
  },
  'oakland': { 
    mapSize: [ 1507, 1796 ],
    stateName: 'Calif.',
    googleMapsQuery: 'Oakland, CA',
    dataUrl: 'http://data.openoakland.org/dataset/zillow-neighborhoods',
    dataTitle: 'OpenOakland'
  },
  'san-francisco': { 
    mapSize: [ 1207, 1207 ],
    stateName: 'Calif.',
    optQuery: 'SELECT * FROM cth_sf_neighborhoods',
    optCartoDbUser: 'mwichary',
    googleMapsQuery: 'San Francisco, CA',
    dataUrl: 'https://data.sfgov.org/Geography/Planning-Neighborhoods/qc6m-r4ih',
    dataTitle: 'San Francisco Data'
  },
  'seattle': { 
    mapSize: [ 2207, 2807 ],
    stateName: 'Wa.',
    optDataFile: 'data/seattle.geojson',
    googleMapsQuery: 'Seattle, WA',
    dataUrl: 'https://data.seattle.gov/dataset/Neighborhoods/2mbt-aqqx',
    dataTitle: 'Data.Seattle.Gov'
  },
};