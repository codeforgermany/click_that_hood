var CITY_DATA = {
  'louisville': {
    stateName: 'Ky.',
    googleMapsQuery: 'Louisville, KY',
    dataUrl: 'http://www.zillow.com/howto/api/neighborhood-boundaries.htm',
    dataTitle: 'Zillow'
  },
  'lexington': { 
    stateName: 'Ky.',
    googleMapsQuery: 'Lexington, KY',
    dataUrl: 'http://www.zillow.com/howto/api/neighborhood-boundaries.htm',
    dataTitle: 'Zillow'
  },
  'oakland': { 
    stateName: 'Calif.',
    googleMapsQuery: 'Oakland, CA',
    dataUrl: 'http://data.openoakland.org/dataset/zillow-neighborhoods',
    dataTitle: 'OpenOakland'
  },
  'san-francisco': { 
    dataUrl: 'https://data.sfgov.org/Geography/Planning-Neighborhoods/qc6m-r4ih',
    dataTitle: 'San Francisco Data',
    stateName: 'Calif.',
    optQuery: 'SELECT * FROM cth_sf_neighborhoods',
    optCartoDbUser: 'mwichary',
    googleMapsQuery: 'San Francisco, CA',
  },  
  'chicago': {
    dataFile: 'data/chicago.geojson',
    dataUrl: 'https://data.cityofchicago.org/Facilities-Geographic-Boundaries/Boundaries-Neighborhoods/9wp7-iasj',
    dataTitle: 'City of Chicago Data Portal',
    stateName: 'Ill.',
    googleMapsQuery: 'Chicago, IL',
  },
  'seattle': { 
    dataFile: 'data/seattle.geojson',
    dataUrl: 'https://data.seattle.gov/dataset/Neighborhoods/2mbt-aqqx',
    dataTitle: 'Data.Seattle.Gov',
    stateName: 'Wa.',
    googleMapsQuery: 'Seattle, WA',
  },
  'macon': {
    dataFile: 'data/macon.geojson',
    dataUrl: 'http://datahub.io/dataset/macon-neighborhoods',
    dataTitle: 'Macon Police Dept',
    stateName: 'Ga.',
    author: 'mapmeld',
    googleMapsQuery: 'Macon, GA',
  },
  'denver': { 
    dataFile: 'data/denver.geojson',
    dataUrl: 'http://data.denvergov.org/dataset/city-and-county-of-denver-statistical-neighborhoods',
    dataTitle: 'Denver Open Data Catalog',
    stateName: 'Colo.',
    googleMapsQuery: 'Denver, CO',
  },
};