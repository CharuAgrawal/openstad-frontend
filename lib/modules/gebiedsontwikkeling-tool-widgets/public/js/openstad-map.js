// todo: marker.doNotCluster kun je niet switchen, want dan raakt hij in de war

var config = config || {};

var bagApiUrl1 = 'https://api.data.amsterdam.nl/bag/nummeraanduiding/?format=json&locatie=[[lat]],[[lng]],50';
var bagApiUrl2 = 'https://api.data.amsterdam.nl/bag/nummeraanduiding/[[id]]/?format=json';

function OpenStadMap(config) {

	let self = this;

	self.defaultConfig = {
		target: 'map',
		style: 'standaard',
		marker: false,
		search: false,
    center: {
			longitude: 4.9005494,
			latitude: 52.3710476
		},
		zoom: 14,
		zoomposition     : 'bottomleft',
		disableDefaultUI : true,
		polygon : null,
		autoZoomAndCenter: false,
		// onClickHandler: config.onClickHandler,
		// onQueryResult: self.onQueryHandler
	};

	self.config = Object.assign(self.defaultConfig, config || {})

	self.markers = [];
	self.createMap();

	return self;

}

OpenStadMap.prototype.createMap = function(config) {

	let self = this;

	// init map
	// todo: mapdiv configurabel
	self.map = amaps.createMap(self.config);

	if (self.config.onClickHandler) {
		self.map.on('click', self.config.onClickHandler);
	}

	if (self.config.useClustering && L.markerClusterGroup) {
		self.markerClusterGroup = L.markerClusterGroup({
			iconCreateFunction: function(cluster) {
				// todo: configurable
				var count = cluster.getChildCount();
				return L.divIcon({ html: count, className: 'icon cluster', iconSize: L.point(count.toString().length * 10 + 5, 22), iconAnchor: [20, 27] });
			}
		});
		self.map.addLayer(self.markerClusterGroup);
	}

	// add polygon
	if (self.config.polygon) {
		self.createCutoutPolygon( self.config.polygon );
	}

	// add markers
	if (self.markers.length) {
		self.createMarkers( self.markers );
	}

	// set bounds and center
	if (self.config.autoZoomAndCenter) {
		var centerOn = self.markers && self.markers.length ? self.markers : self.config.polygon;
		if (self.editorMarker) {
			if (self.editorMarker.position) {
				centerOn = [self.editorMarker];
			} else {
				centerOn = self.config.polygon;
			}
		}
		if (centerOn) {
			self.setBoundsAndCenter( centerOn ); // prefer markers
		}
	}

}

OpenStadMap.prototype.createMarkers = function( markers ) {

	self = this;

	markers.forEach(function(marker) {
		self.createMarker( marker )
	})

}

OpenStadMap.prototype.addMarker = function(markerData) {

	var self = this;

	var options = {
		position    : markerData.position && markerData.position.coordinates ? { lat: markerData.position.coordinates[0], lng: markerData.position.coordinates[1] } : markerData.position,
		map         : self.map,
		icon        : markerData.icon,
	}

	var marker;
	if (markerData.icon) {
		marker = L.marker([markerData.lat, markerData.lng], { icon: markerData.icon });
	} else {
		marker = L.marker([markerData.lat, markerData.lng]);
	}

	marker.doNotCluster = markerData.doNotCluster;

	if (markerData.href) {
		marker.on('click', function() {
			eval(markerData.href(marker));
		});
	}

	if (self.markerClusterGroup && !markerData.doNotCluster) {
		self.markerClusterGroup.addLayer(marker);
	} else {
		marker.addTo(self.map)
	}

	self.markers.push(marker);
	self.applyFilter();

	marker.id = parseInt( 1000000 * Math.random() );

	return marker;

}

OpenStadMap.prototype.setFilter = function(filterFuntion) {
	let self = this;
	self.filterFunction = filterFuntion;
	self.applyFilter();
}

OpenStadMap.prototype.applyFilter = function() {
	let self = this;
	if (self.filterFunction) {
		self.markers.forEach((marker) => {
			if ( self.filterFunction(marker) ) {
				self.showMarker(marker);
			} else {
				self.hideMarker(marker);
			}
		});
	} else {
		self.markers.forEach((marker) => {
			self.showMarker(marker);
		});
	}

}

OpenStadMap.prototype.showMarker = function(marker) {
	let self = this;
	if (self.markerClusterGroup && !marker.doNotCluster) {
		self.markerClusterGroup.addLayer(marker);
	} else {
		marker.addTo(self.map)
	}
}

OpenStadMap.prototype.hideMarker = function(marker) {
	let self = this;
	if (self.markerClusterGroup && !marker.doNotCluster) {
		self.markerClusterGroup.removeLayer(marker);
	} else {
		marker.remove(self.map)
	}
}

OpenStadMap.prototype.removeMarker = function(marker) {
	let self = this;
	if (self.markerClusterGroup && !marker.doNotCluster) {
		self.markerClusterGroup.removeLayer(marker);
	} else {
		marker.remove(self.map)
	}
	self.markers.forEach((entry, index) => {
		if (entry.id == marker.id) {
			self.markers.splice(index, 1);
		}
	});
}

OpenStadMap.prototype.updateMarker = function(args) {
	// nu alleen positie
  args.marker.setLatLng({ lat: args.lat, lng: args.lng });
}

OpenStadMap.prototype.createCutoutPolygon = function( polygon ) {

	var self = this;

	// polygon must defined from the south west corner to work with the outer box
	var bounds = L.polygon(polygon).getBounds();
	var center = bounds.getCenter();

	var smallest = 0; var index = 0;
	
	polygon.forEach(function( point, i ) {
		var y = Math.sin(point.lng-center.lng) * Math.cos(point.lat);
		var x = Math.cos(center.lat)*Math.sin(point.lat) - Math.sin(center.lat)*Math.cos(point.lat)*Math.cos(point.lng-center.lng);
		var bearing = Math.atan2(y, x) * 180 / Math.PI;
		if (45 - bearing < smallest) {
			smallest = 45 - bearing;
			index = i;
		}
	});

	let a = polygon.slice(0, index - 1);
	let b = polygon.slice(index, polygon.length - 1);
	polygon = b.concat(a);
	
	// outer box
	// TODO: should be calculated dynamically from the center point
	var delta1 = 0.01;
	var delta2 = 5;
	var outerBox = [
		{lat: -90 + delta2, lng:  -180 + delta1 },
		{lat: -90 + delta2, lng:     0          },
		{lat: -90 + delta2, lng:   180 - delta1 },
		{lat:   0,          lng:   180 - delta1 },
		{lat:  90 - delta2, lng:   180 - delta1 },
		{lat:  90 - delta2, lng:     0          },
		{lat:  90 - delta2, lng:  -180 + delta1 },
		{lat:  90 - delta2, lng:  -180 + delta1 },
		{lat:   0,          lng:  -180 + delta1 },
	];
	
	// polygon style
	// this.map.data.setStyle( Object.assign({}, self.polygonStyle ));
	
	// this.map.data.add({
	//  	 geometry: new google.maps.Data.Polygon( [outerBox, polygon] )
	// })

	L.polygon([outerBox, polygon], {
		"color": "#d00",
		"fillColor": "#000",
		"fillOpacity": 0.15
	}).addTo(self.map);

}

OpenStadMap.prototype.setBoundsAndCenter = function( points ) {

	var self = this;
	points = points || [];

	// todo
	// if (self.map.minZoom) {
	//  	google.maps.event.addListenerOnce(self.map, 'bounds_changed', function() {
	//  		if( self.map.getZoom() > self.map.maxZoom - 1 ) {
	//  			self.map.setZoom( self.map.maxZoom - 1 );
	//  		}
	//  		if( self.map.getZoom() < self.map.minZoom + 1 ) {
	//  			self.map.setZoom( self.map.minZoom + 1 );
	//  		}
	//  	});
	// }

	var poly = [];
	points.forEach(function(point) {
		if (point._latlng) {
			point = point._latlng;
		}
		if (point.position) {
			point = point.position.coordinates ? { lat: point.position.coordinates[0], lng: point.position.coordinates[1] }  : point.position;
		}
		poly.push(point);
	})
	
	points.forEach(function(point) {
		poly.push(point);
	})

	var bounds = L.latLngBounds(poly);
	self.map.fitBounds(bounds);

	let zoom = parseInt(self.map.getZoom())

	// xxx

}

OpenStadMap.prototype.getPointInfo = function(latlng, marker, next) {

	var self = this;

	latlng = latlng || {};

	// todo: fetch herschrijven naar iets dat ook werkt in IE9
	
	var url = bagApiUrl1
			.replace(/\[\[lat\]\]/, latlng.lat)
			.replace(/\[\[lng\]\]/, latlng.lng);

	fetch(url)
		.then( response => response.json() )
		.then( json => json && json.results && json.results[0] && json.results[0].landelijk_id )
		.then( id => {

			var url = bagApiUrl2
					.replace(/\[\[id\]\]/, id)

			fetch(url)
				.then( response => response.json() )
				.then( json => {
					json.lat = latlng.lat;
					json.lng = latlng.lng;
					if (next) next(json, marker);
				})
				.catch( err => self.handleErrors(err) )

		})
		.catch( err => self.handleErrors(err) )

}

OpenStadMap.prototype.handleErrors = function(error) {
	// todo: moet je kunnen meegeven in de config
	console.log(error);
}