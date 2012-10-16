/*
 * Grunt Task File
 * ---------------
 *
 * Task: Server
 * Description: Serve the web application.
 * Dependencies: express
 *
 */

module.exports = function(grunt) {

  var _ = grunt.utils._;
  // Shorthand Grunt functions
  var log = grunt.log;

  grunt.registerTask("server", "Run development server.", function(prop) {
    var options, done;
    var props = ["server"];
    var args = this.args;

    // Only keep alive if watch is not set.
    done = args[args.length-1] === "watch" ? function() {} : this.async();

    // If a prop was passed as the argument, use that sub-property of server.
    if (prop) { props.push(prop); }

    // Defaults set for server values
    options = _.defaults(grunt.config(props) || {}, {
      favicon: "./favicon.ico",
      index: "./index.html",

      port: process.env.PORT || 8000,
      host: process.env.HOST || "127.0.0.1"
    });

    options.folders = options.folders || {};

    // Ensure folders have correct defaults
    options.folders = _.defaults(options.folders, {
      map: "./map",
      assets: "./assets",
      dist: "./dist"
    });

    options.files = options.files || {};

    // Ensure files have correct defaults
    options.files = _.defaults(options.files, {
      "map/config.js": "map/config.js"
    });

    // Run the server
    grunt.helper("server", options);

    // Fail task if errors were logged
    if (grunt.errors) { return false; }

    log.writeln("Listening on http://" + options.host + ":" + options.port);
  });

  grunt.registerHelper("server", function(options) {
    // Require libraries.
    var fs = require("fs");
    var path = require("path");
    var express = require("express");

    // If the server is already available use it.
    var site = options.server ? options.server() : express();

    // Allow users to override the root.
    var root = _.isString(options.root) ? options.root : "/";

    // Process stylus stylesheets.
    site.get(/.styl$/, function(req, res) {
      var url = req.url.split("assets/css/")[1];
      var file = path.join("assets/css", url);

      fs.readFile(file, function(err, contents) {
        grunt.helper("stylus", contents.toString(), {
          paths: ["assets/css/"]
        }, function(css) {
          res.header("Content-type", "text/css");
          res.send(css);
        });
      });
    });

    // Process LESS stylesheets.
    site.get(/.less$/, function(req, res) {
      var url = req.url.split("assets/css/")[1];
      var file = path.join("assets/css", url);

      fs.readFile(file, function(err, contents) {
        grunt.helper("less", contents.toString(), {
          paths: ["assets/css/"]
        }, function(css) {
          res.header("Content-type", "text/css");
          res.send(css);
        });
      });
    });

    // Configure static folders.
    Object.keys(options.folders).sort().reverse().forEach(function(key) {
      site.get(root + key + "/*", function(req, res, next) {
        // Find filename.
        var filename = req.url.slice((root + key).length);

        res.sendfile(path.join(options.folders[key] + filename));
      });
    });

    // Configure static files.
    if (_.isObject(options.files)) {
      Object.keys(options.files).sort().reverse().forEach(function(key) {
        site.get(root + key, function(req, res) {
          return res.sendfile(options.files[key]);
        });
      });
    }

    // Serve favicon.ico.
    site.use(express.favicon(options.favicon));
    

    /**
     * Start Nodetiles
     */
    var nodetiles = options.nodetiles; // Options
    console.log(nodetiles);
    var map = require('nodetiles');
    var GeoJsonSource = map.datasources.GeoJson;
    var PostGISSource = map.datasources.PostGIS;
    var projector = map.projector;
    
    // create the map context
    var map = new map.Map({
      projection: nodetiles.projection
    });
    
    // Serve the tiles
    site.get('/tiles/:zoom/:col/:row.png', function tile(req, res) {
      var tileCoordinate, bounds;
  
      // verify arguments
      var tileCoordinate = [req.params.zoom, req.params.col, req.params.row].map(Number);
      if (!tileCoordinate || tileCoordinate.length != 3) {
        res.send(404, req.url + 'not a coordinate, match =' + tileCoordinate);
        return;
      }
      // set the bounds and render
      bounds = projector.util.tileToMeters(tileCoordinate[1], tileCoordinate[2], tileCoordinate[0]);
      map.render(bounds[0], bounds[1], bounds[2], bounds[3], 256, 256, function(error, canvas) {
        var stream = canvas.createPNGStream();
        stream.pipe(res);
      });
    });
    
    // serve the utfgrid
    site.get('/utfgrids/:zoom/:col/:row.:format?', function utfgrid(req, res) {
      var tileCoordinate, respondWithImage, renderHandler, bounds;
      
      // verify arguments
      var tileCoordinate = [req.params.zoom, req.params.col, req.params.row].map(Number);
      if (!tileCoordinate || tileCoordinate.length != 3) {
          res.send(404, req.url + 'not a coordinate, match =' + tileCoordinate);
          return;
      }
    
      respondWithImage = req.params.format === 'png';
      if (respondWithImage) {
        renderHandler = function(err, canvas) {
          var stream = canvas.createPNGStream();
          stream.pipe(res);
        };
      }
      else {
        renderHandler = function(err, grid) {
          res.jsonp(grid);
        };
      }
      
      bounds = projector.util.tileToMeters(tileCoordinate[1], tileCoordinate[2], tileCoordinate[0], 64); // 
      map.renderGrid(minX, minY, maxX, maxY, 64, 64, respondWithImage, renderHandler);
    });
    
    
    // Serve the tile.jsonp
    site.get(root + 'tile.:format', function(req, res) {
      if (req.params.format === 'json' || req.params.format === 'jsonp' ) {
        fs.readFile(nodetiles.tilejson, 'utf8', function(err, contents) {
          return res.jsonp(JSON.parse(contents));
        });
      }
      else {
        return req.next();
      }
    });
    
    
    /**
     * /End Nodetiles
     */
    
    // Ensure all routes go home, client side app..
    site.all("*", function(req, res) {
      fs.createReadStream(options.index).pipe(res);
    });

    // Actually listen
    site.listen(options.port, options.host);
  });

};
