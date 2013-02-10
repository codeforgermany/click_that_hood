// TODO re-sort by addition, sort by name automatically
var CITY_DATA = {
  'chicago': {
    stateName: 'Ill.',
    optDataFile: 'data/chicago.geojson',
    googleMapsQuery: 'Chicago, IL',
    dataUrl: 'https://data.cityofchicago.org/Facilities-Geographic-Boundaries/Boundaries-Neighborhoods/9wp7-iasj',
    dataTitle: 'City of Chicago Data Portal'
  },
  'lexington': { 
    stateName: 'Ky.',
    googleMapsQuery: 'Lexington, KY',
    dataUrl: 'http://www.zillow.com/howto/api/neighborhood-boundaries.htm',
    dataTitle: 'Zillow'
  },
  'louisville': {
    stateName: 'Ky.',
    googleMapsQuery: 'Louisville, KY',
    dataUrl: 'http://www.zillow.com/howto/api/neighborhood-boundaries.htm',
    dataTitle: 'Zillow'
  },
  'macon': {
    stateName: 'Ga.',
    author: 'mapmeld',
    optDataFile: 'data/macon.geojson',
    googleMapsQuery: 'Macon, GA',
    dataUrl: 'http://datahub.io/dataset/macon-neighborhoods',
    dataTitle: 'Macon Police Dept'
  },
  'oakland': { 
    stateName: 'Calif.',
    googleMapsQuery: 'Oakland, CA',
    dataUrl: 'http://data.openoakland.org/dataset/zillow-neighborhoods',
    dataTitle: 'OpenOakland'
  },
  'san-francisco': { 
    stateName: 'Calif.',
    optQuery: 'SELECT * FROM cth_sf_neighborhoods',
    optCartoDbUser: 'mwichary',
    googleMapsQuery: 'San Francisco, CA',
    dataUrl: 'https://data.sfgov.org/Geography/Planning-Neighborhoods/qc6m-r4ih',
    dataTitle: 'San Francisco Data'
  },
  'seattle': { 
    stateName: 'Wa.',
    optDataFile: 'data/seattle.geojson',
    googleMapsQuery: 'Seattle, WA',
    dataUrl: 'https://data.seattle.gov/dataset/Neighborhoods/2mbt-aqqx',
    dataTitle: 'Data.Seattle.Gov'
  },
};