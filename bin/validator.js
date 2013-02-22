var fs = require('fs')

var validator = function(metadataFilePath) {
    
    var validationErrors = [],
        validationSuccesses = []

    var validateMetadataFileExists = function() {
        var exists = fs.existsSync(metadataFilePath)
        if (!exists) {
            validationErrors.push("No metadata file found at " + metadataFilePath)
        } else {
            validationSuccesses.push("Metadata file exists");
        }

        return exists
    }

    var validateMetadataRequiredFields = function() {
        return true
    }

    var validateMetadataDataFile = function() {
        return true
    }

    var validateMetadataDataUrl = function() {
        return true
    }

    var validateMetadataAuthor = function() {
        return true
    }

    return {

        isValid: function() {
            return (validateMetadataFileExists()
                    && validateMetadataRequiredFields()
                    && validateMetadataDataFile()
                    && validateMetadataDataUrl()
                    && validateMetadataAuthor())
        },

        getValidationReport: function() {
            var report = "Validation report:\n\n"

            report += "Successes:\n"
            for (successIndex in validationSuccesses) {
                var success = validationSuccesses[successIndex]
                report += "\t+ " + success + "\n"
            }

            report += "Failures:\n"
            for (failureIndex in validationErrors) {
                var failure = validationErrors[failureIndex]
                report += "\t+ " + failure + "\n"
            }

            return report
        }

    }

}

var printUsage = function(exitCode) {

    console.log("Usage: ")
    console.log("\tnode validator.js <location name>")
    console.log()

    process.exit(exitCode)

}

// Main
if (process.argv.length != 3) {
    console.error("Location name not specified.")
    printUsage(1)
}

var metadataFilePath = __dirname + "/../public/data/" + process.argv[2] + ".metadata.json";

var v = validator(metadataFilePath)
var isValid = v.isValid();
console.log(v.getValidationReport())
if (!isValid) {
    process.exit(2)
}

