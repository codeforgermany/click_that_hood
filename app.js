var express = require('express'),
    lessMiddleware = require('less-middleware');

var app = express();

app.use(express.compress());

app.use(lessMiddleware({
    src: __dirname + '/public',
    once: true
}));

app.use(express.static(__dirname + '/public'));
    
var port = process.env.PORT || 8000;
app.listen(port, null, null, function() {
    console.log("Listening on port " + port);
});

