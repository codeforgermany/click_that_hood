var express = require("express"),
  lessMiddleware = require("less-middleware"),
  compression = require("compression"),
  config = require("config");

var engineLightStatusEndpoint = function (req, res) {
  var response = {
    status: "ok",
    updated: Math.round(Date.now() / 1000),
    dependencies: ["MapBox"],
    resources: [],
  };

  res.send(response);
};

function startApp() {
  var app = express();

  app.use(compression());

  app.use(
    lessMiddleware(__dirname + "/public", {
      compress: process.env.NODE_ENV == "production",
      once: process.env.NODE_ENV == "production",
    })
  );

  // Redirect to environment-appropriate domain, if necessary
  app.all("*", function (req, res, next) {
    if (config.app_host_port != req.headers.host) {
      var redirectUrl = "http://" + config.app_host_port + req.url;
      console.log("Redirecting to " + redirectUrl + "...");
      res.redirect(301, redirectUrl);
    } else {
      next("route");
    }
  });

  // Engine-light endpoint
  app.get("/.well-known/status", engineLightStatusEndpoint);

  app.get("/:location", function (req, res) {
    res.sendFile(__dirname + "/public/index.html");
  });

  app.get("/", function (req, res) {
    // redirect old-style /?location=XYZ and /?city=XYZ urls to new-style /XYZ
    if (req.query.location) {
      res.redirect(301, req.query.location);
    } else if (req.query.city) {
      res.redirect(301, req.query.city);
    } else {
      res.sendFile(__dirname + "/public/index.html");
    }
  });

  app.use(express.static(__dirname + "/public"));

  app.listen(config.port, null, null, function () {
    console.log("The app is running: http://" + config.app_host_port);
  });
}

startApp();
