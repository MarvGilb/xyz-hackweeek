Math.sinh = function(x) {
  return 0.5*(Math.pow(Math.E,x) - Math.pow(Math.E,-x))
}

function getLatLonOfProjectedPoint( x,  y){
  y = Math.atan(Math.sinh(y));
  return [x,y];
}

function createDataRectangle( level,  row,  col) {
  var numRowsCols = Math.pow(2, level);
  var tileSize = (2. * Math.PI) / numRowsCols;

  var RAD_TO_WGS84 = 180. / Math.PI;


  var maxX = ((-Math.PI) + tileSize * (col + 1)) * RAD_TO_WGS84;
  var minX = ((-Math.PI) + tileSize * col) * RAD_TO_WGS84;
  var maxY = Math.PI - tileSize * row;
  var minY = Math.PI - tileSize * (row + 1);

  maxY = Math.atan( (Math.exp(maxY) - Math.exp(-maxY)) / 2  ) * RAD_TO_WGS84;
  minY = Math.atan( (Math.exp(minY) - Math.exp(-minY)) / 2  ) * RAD_TO_WGS84;

  //console.log(' minProjected: '+minProjected+' maxProjected: '+maxProjected);
  //console.log('N01 '+level+','+row+','+col+'  -   '+minX+','+minY+','+maxX+','+maxY);

  return minX+','+minY+','+maxX+','+maxY;
}


function createDataRectangleArray( level,  row,  col) {
  var numRowsCols = Math.pow(2, level);
  var tileSize = (2. * Math.PI) / numRowsCols;

  var maxX = (-Math.PI) + tileSize * (col + 1);
  var minX = (-Math.PI) + tileSize * col;
  var maxY = Math.PI - tileSize * row;
  var minY = Math.PI - tileSize * (row + 1);

  var minProjected = getLatLonOfProjectedPoint(minX,minY);
  var maxProjected = getLatLonOfProjectedPoint(maxX,maxY);

  var RAD_TO_WGS84 = 180 / Math.PI;

  maxX = maxProjected[0] * RAD_TO_WGS84;
  minX = minProjected[0] * RAD_TO_WGS84;
  maxY = maxProjected[1] * RAD_TO_WGS84;
  minY = minProjected[1] * RAD_TO_WGS84;

  //console.log(' minProjected: '+minProjected+' maxProjected: '+maxProjected);
  //console.log('N01 '+level+','+row+','+col+'  -   '+minX+','+minY+','+maxX+','+maxY);

  return [minX,minY,minX,maxY,maxX,maxY,maxX,minY];
}

function TileXYToQuadKey(levelOfDetail, tileX, tileY ) {
  //if(debugOn)console.log("levelOfDetail "+levelOfDetail);
  var quadKey = '';
  for(var i = levelOfDetail; i > 0; i--){
    var digit = '0';
    var mask = 1 << (i - 1);

    if ((tileY & mask) != 0){
      digit++;
    }
    if ((tileX & mask) != 0){
      digit++;
      digit++;
    }
    quadKey+=digit;
  }
  return quadKey;
}

function quadToBBOX(quadKey){
  quadKey = String(quadKey);
  var x = 0, y = 0;
  for(var i = 0; i < quadKey.length; ++i) {
    x *= 2;
    y *= 2;
    switch (quadKey[i]) {
      case '1': y++;
        break;
      case '3': y++;
      case '2': x++;
    }
  }

  return createDataRectangleArray(quadKey.length, x, y);
}

function coordToQuad (longitude, latitude, level) {

  var   sinLatitude = Math.sin(latitude * Math.PI / 180),
    row = Math.floor(((longitude + 180) / 360) * Math.pow(2, level)),
    col = Math.floor((.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * Math.pow(2, level));

  return TileXYToQuadKey(level,col,row);
}

/* Adapted code from
   http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection
   http://www.maptiler.org/google-maps-coordinates-tile-bounds-projection/globalmaptiles.py
*/

//	"Initialize the TMS Global Mercator pyramid"
var	s_tileSize = 256;
var	s_initialResolution = 2 * Math.PI * 6378137 / s_tileSize;
//	# 156543.03392804062 for tileSize 256 pixels
var	s_originShift = 2 * Math.PI * 6378137 / 2.0;
//	# 20037508.342789244

function Resolution( zoom ) {
  //"Resolution (meters/pixel) for given zoom level (measured at Equator)"

  //# return (2 * math.pi * 6378137) / (self.tileSize * 2**zoom)
  return s_initialResolution / Math.pow(2, zoom);
}


function PixelsToMeters( px, py, zoom) {
  "Converts pixel coordinates in given zoom level of pyramid to EPSG:900913"

  var res = Resolution( zoom );
  var mx = px * res - s_originShift;
  var my = py * res - s_originShift;
  return [mx, my];
}

function TileBounds( tx, ty, zoom) {
  //"Returns bounds of the given tile in EPSG:900913 coordinates"

  ty = (Math.pow(2, zoom) - 1) - ty;

  var min = PixelsToMeters( tx*s_tileSize, ty*s_tileSize, zoom );
  var max = PixelsToMeters( (tx+1)*s_tileSize, (ty+1)*s_tileSize, zoom );

  //return ( min[0], min[1], max[0], max[1] );

  return min[0] + ',' + min[1] + ',' + max[0] +','+ max[1];
}

module.exports = {
  TileBounds: TileBounds,
  PixelsToMeters: PixelsToMeters,
  Resolution: Resolution,
  coordToQuad: coordToQuad,
  quadToBBOX: quadToBBOX,
  TileXYToQuadKey: TileXYToQuadKey,
  createDataRectangleArray: createDataRectangleArray,
  createDataRectangle: createDataRectangle,
  getLatLonOfProjectedPoint: getLatLonOfProjectedPoint
};