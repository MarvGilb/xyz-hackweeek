var log = require('node_common/logger'),
  request = require('request'),
  waiter = require("node_common/waiter"),
  w,
  geoFunctions = require("./geoFunctions.js");

var config = {
  spaceIdVectorService: "spaceId",
  spaceIdMapfeedback: "spaceId",
  basicAuth: "basicAuthTokenForSplunk",
  token: "writeTokenToSpace",
  splunkRegExVectorService: "(\\d{4}-\\d{2}-\\d{2})\\s(\\d{2}).*[/](\\d{1,4})\\/all[/](\\d*)[/](\\d*)[/](\\d*).mvt",
  splunkRegExMapFeedback: ".*time\"\\:[\\s]?\"([0-9-]+)T([0-9]{0,2}).*coordinates\\\\\"\\:[\\s]?[[]+(\\d+.\\d+),(\\d+.\\d+).*type\\\\\"\\:[\\s]?\\\\\"([a-zA-Z\\s]*)\\\\\".*roadname\\\\\"\\:[\\s]?\\\\\"([a-zA-Z\\s]*)\\\\\"",
  splunkOsmVectorService: "search index=cpaws+role=osm-vector-service+sourcetype=gunicorn+\".mvt\"",
  splunkMapFeedback: "search index=cpaws+sourcetype=wikvaya+src=PostFeedback*",
  splunkURL: "https://someSplunkURL"
}
log.level = 3;

var addDataToSpace = function(spaceId, featureCollection) {

  log.info("Adding feature with " + featureCollection.features.length + " features.");

  var options = {
    method: 'PUT',
    url: 'https://xyz.api.here.com/hub/spaces/' + spaceId + '/features',
    headers:
      {
        'Authorization': 'Bearer ' + config.token,
        'Content-Type': 'application/geo+json'
      },
    body: JSON.stringify(featureCollection)
  };

  if (featureCollection.features.length == 0) {
    log.info("Nothing to add.");
    return;
  }

  request(options, w = waiter());
  var response =  w.wait();
  if (response[1].type == "error") {
    log.error("Failed to add FeatureCollection");
    log.error(response[2]);
  } else {
    log.info("Added FeatureCollection.");
    log.info(response[1].body);
  }
}

var requestLogsFromSplunk = function(splunkSearch, from, to, type, callback) {
  var options = {
    method: 'POST',
    url: config.splunkURL + '/services/search/jobs/export?output_mode=' + type,
    headers:
      {
        'Authorization': 'Basic ' + config.basicAuth
      },
    body: 'search=' + splunkSearch + ' earliest_time=' + from + ' latest_time=' + to
  };

  log.info("Splunk request: " + options.body);

  request(options, w = waiter());
  var response =  w.wait();
  if (response[0]) {
    log.error(response[0]);
    callback(response[0]);
  }
  callback(null, response[1]);
}

var convertSplunkVectorServiceLogToFeature = function(match) {
  var quadKey = geoFunctions.TileXYToQuadKey(match[4], match[6], match[5]);
  var customUbbox = geoFunctions.quadToBBOX(quadKey);
  var feature = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [
        customUbbox[4] + ((customUbbox[2] - customUbbox[4]) / 2),
        customUbbox[3] + ((customUbbox[1] - customUbbox[3]) / 2)
      ]

    },
    properties: {
      '@ns:com:here:xyz': {
        tags:[
          'date:' + match[1],
          'hour:' + match[2]
        ]
      },
      level: match[4],
      resolution: match[3]
    }
  };

  return feature;
}

var osmVectorService = function() {
  requestLogsFromSplunk(config.splunkOsmVectorService,'-15m@m', 'now', 'raw', w = waiter());
  var splunkEntries = w.wait();
  if (splunkEntries[0] != null) {
    log.error("Failed to load logs from Splunk.", splunkEntries[0]);
  }

  var featureCollection = {
    type: "FeatureCollection",
    features: []
  };

  splunkEntries[1].body.split("\n").forEach(function(logLine) {
    if (logLine != null && logLine != "") {
      try {
        var match = RegExp(config.splunkRegExVectorService, "g").exec(logLine);
        log.debug("Match: " + match);
        if (match != null && match.length == 7) {
          var feature = convertSplunkVectorServiceLogToFeature(match);
          if (feature) featureCollection.features.push(feature);
          else log.error(logLine);
        } else {
          log.error("Could not process log line: " + logLine);
        }
      } catch (err) {
        log.error("Could not create Feature. ", err);
        log.error(logLine);
      }
    }
  });
  addDataToSpace(config.spaceIdVectorService, featureCollection);
}

exports.handler = function(event, context) {
  try {
    osmVectorService();
  } catch(err) {
    log.error(err);
    throw new Error("Could not process request.");
  }
};
