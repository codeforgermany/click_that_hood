var express = require('express')

var app = express();
app.use(express.compress());

// Serve all other URIs as static files from the "public" directory.
app.use(express.static(__dirname + '/public'));

var port = process.env.PORT || 8000;
app.listen(port, null, null, function() {
    console.log("Listening on port " + port);
});

