var fs = require('fs')

var validator = function(metadataFilePath) {

  var validationFailures = [],
  validationSuccesses = []

  var metadataFileExists = function() {
    var exists
    return function() {
      if (exists === undefined){
        exists = fs.existsSync(metadataFilePath)
      }
      return exists
    }
  }()

  var validateMetadataFileExists = function() {
    if (metadataFileExists()) {
      validationSuccesses.push('Metadata file exists');
    } else {
      validationFailures.push('No metadata file found at ' + metadataFilePath)
    }
  }

  var validateMetadataRequiredFields = function() {

    if (metadataFileExists()) {

      var requiredFieldsMap = {
        locationName: 'location name',
        dataUrl: 'data source URL',
        dataTitle: 'data source title',
        authorTwitter: 'author\'s twitter ID'
      }

      var j = getMetadataJson()
      for (var field in requiredFieldsMap) {
        var label = requiredFieldsMap[field]
        if (j.hasOwnProperty(field)) {
          validationSuccesses.push('Metadata JSON contains ' + label + ' (' + field + ')')
        } else {
          validationFailures.push('Please specify ' + label + ' (' + field + ') in metadata JSON')
        }

      }

    }

  }

  var validateMetadataDataUrl = function() {

    if (metadataFileExists()) {

      var j = getMetadataJson()
      if (j.dataUrl.match(/^https?\:\/\/.*\..+/)) {
        validationSuccesses.push('Metadata JSON contains valid data source URL (dataUrl)')
      } else {
        validationFailures.push('Please specify valid data source URL (dataUrl) in metadata JSON')
      }

    }

  }

  var validateDataFileExists = function() {
    var dataFilePath = getDataFilePath()
    var exists = fs.existsSync(dataFilePath)
    if (exists) {
      validationSuccesses.push('Data file exists')
    } else {
      validationFailures.push('No data file found at ' + dataFilePath)
    }
  }

  var getMetadataJson = function() {

    if (metadataFileExists()) {

      var metadataJson

      return function() {

        if (!metadataJson) {
          metadataJson = JSON.parse(fs.readFileSync(metadataFilePath))
        }
        return metadataJson

      }

    }

  }()

  var getDataFilePath = function() {
    return metadataFilePath.replace(/\.metadata\.json/, '.geojson')
  }

  return {

    validate: function() {
      validateMetadataFileExists()
      validateMetadataRequiredFields()
      validateMetadataDataUrl()
      validateDataFileExists()
    },

    isValid: function() {
      return validationFailures.length === 0
    },

    getSuccesses: function() {
      return validationSuccesses
    },

    getFailures: function() {
      return validationFailures
    },

    getValidationReport: function() {
      var report = 'Validation report:\n\n'

      report += 'Successes:\n'
      for (var successIndex in validationSuccesses) {
        var success = validationSuccesses[successIndex]
        report += '\t+ ' + success + '\n'
      }

      report += 'Failures:\n'
      for (var failureIndex in validationFailures) {
        var failure = validationFailures[failureIndex]
        report += '\t+ ' + failure + '\n'
      }

      return report
    }

  }

}

var printUsage = function(exitCode) {

  console.log('Usage: ')
  console.log('\tnode validator.js <location name>')
  console.log()

  process.exit(exitCode)

}

// Main
if (process.argv.length != 3) {
  console.error('Location name not specified.')
  printUsage(1)
}

var metadataFilePath = __dirname + '/../public/data/' + process.argv[2] + '.metadata.json';

var v = validator(metadataFilePath)
v.validate()
console.log(v.getValidationReport())
if (!v.isValid()) {
  var ERR_VALIDATION_FAILURES_OFFSET = 100;
  process.exit(ERR_VALIDATION_FAILURES_OFFSET + v.getFailures().length)
}

