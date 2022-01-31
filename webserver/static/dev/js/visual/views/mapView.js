define(function (require) {
	var $ = require('jquery');
	var Backbone = require('backbone');
	var d3 = require('d3');
    var _ = require('underscore');
	var world = require('text!static/world.json');
	var topojson = require('topojson');
    var Utils = require('utils');

	var MapView = Backbone.View.extend({
		template: $("#template-map").html(),

		events: {
			"click #map-buttons .icon-zoom-in": "clickZoomIn",
			"click #map-buttons .icon-zoom-out": "clickZoomOut",
			"click #map-buttons .icon-resize-normal": "clickReset"
		},

		initialize: function(){
			this.$el.html(this.template);

			this.$svg = $("#map-svg", this.$el);
			this.$spacer = $(".spacer", this.$el);
			this.$buttons = $("#map-buttons", this.$el);
			this.$content = $("#content");
			this.$legendText = $(".legend .label", this.$el);

			this.svg = d3.select(this.el).select('#map-svg');
			this.topology = JSON.parse(world);

			var _this = this;

			var grat = d3.geo.graticule()
				.step([10,10]);

			this.lines = this.svg.append('g').append("path")
				.datum(grat)
				.attr("class", "graticule")
				.attr("fill", "none");

			this.countries = this.svg.append("g")
				.selectAll("path")
				.data(topojson.feature(this.topology, this.topology.objects.countries).features)
				.enter()
				.append("path")
				.filter(function(d) { return d.id !== 10; }) //ignore Antartica
				.attr('class', "country");

			this.sphere = this.svg.append('g').append("path")
				.datum({type: "Sphere"})
				.attr("id", "sphere")
				.attr("fill", "none");

			this.path = d3.geo.path();

//			this.tooltip = this.svg.append("div")
//				.attr("class", "tooltip")
//				.style("opacity", 0);  //Throws cannot set style of undefined error in IE

			this.scaleDomain = [-1, 0, 0.1, 0.5];
			this.colourScale = d3.scale.linear()
				.range(["#000", "#0C0C19", "#2885B7", "#FFFFFF"])
				.domain(this.scaleDomain);

			this.legend = d3.select(this.el).select('.legend svg');
			var gradient = this.legend.append("svg:defs")
				.append("svg:linearGradient")
				.attr("id", "legend-gradient")
				.attr("x1", "0%")
				.attr("x2", "100%")
				.attr("spreadMethod", "pad")
				.selectAll("stop")
				.data(this.scaleDomain)
				.enter().append("stop")
				.attr("offset", function(d) { return d * ( 1/_.last(_this.scaleDomain) ); })
				.attr("stop-color", function(d) { return _this.colourScale(d); });

			this.scale = 0;
			this.translation = [0,0];

			this.isAnimating = false;
		},

		render: function() {
            this.delegateEvents();

			this.setMode();
			this.setLegend();
            this.setCountry();

			$(window).bind("resize", _.bind(_.debounce(this.resize, Utils.RESIZE_DELAY), this));
			this.svg.on("mousedown", _.bind(this.mouseDown, this));
			this.countries.on("click", _.bind(this.mouseClickCountry, this));
			this.listenTo(this.model, "change:date", this.setColours);
			this.listenTo(this.model.mapModel, "change:data", this.setColours);
			this.listenTo(this.model.mapModel, "change:mode", this.setMode);
			this.listenTo(this.model.mapModel, "change:legend", this.setLegend);
			this.listenTo(this.model, "change:country", this.setCountry);

			return this;
		},

		remove: function() {
            this.undelegateEvents();

			$(window).unbind("resize");
			$(window).unbind("mouseup");
			$(window).unbind("mousemove");

			this.svg.on("mousedown", null);

			this.countries.on("click", null);

			Backbone.View.prototype.remove.call(this);
		},

		mouseClickCountry: function(d){
			//d3 Country paths
			d3.event.preventDefault();
			d3.event.stopPropagation();

			if(!this.isAnimating &&
				Math.abs(this.mouseFirst[0]-d3.mouse(this.svg[0][0])[0]) <= 1 &&
				Math.abs(this.mouseFirst[1] === d3.mouse(this.svg[0][0])[1]) <= 1){
				//check mouse didn't move much
				if(this.mode === "sphere"){
					Backbone.history.navigate("hosts", true);
				} else {
					var country = Utils.isoToCode(d.id);
					if(country && country !== this.model.get('country')){
						Backbone.history.navigate(this.model.get('pageBase') + "/country-" + country,
							{trigger: this.model.get('routeLabel') === "country" ? true : false}); //trigger page update if on country page only
						this.model.set('country', country);
					}else if(this.model.get('routeLabel') !== "country") { //don't allow unset of country on country page
						Backbone.history.navigate(this.model.get('pageBase'));
						this.model.set('country', null);
					}
				}
			}
		},

		mouseDown: function() {
			//d3 SVG
			d3.event.preventDefault();

			if (d3.event.button !== 0)
				return; //return if not left click

			this.mouseLast = d3.mouse(this.svg[0][0]);
			this.mouseFirst = d3.mouse(this.svg[0][0]);

			if(!this.isAnimating){
				if(this.mode === "sphere"){
					this.svg.on("mousemove", _.bind(this.mouseMoveSphere, this));
				}else{
					if(this.scale > 1) {
						this.svg.on("mousemove", _.bind(this.mouseMoveFlat, this));
					}
				}

				$(window).mouseup(_.bind(this.mouseUp, this));
			}
		},

		mouseUp: function(_event) {
			//window
			_event.preventDefault();

			this.svg.on("mousemove", null);
			$(window).unbind("mouseup");
		},

		mouseMoveSphere: function(){
			//d3 SVG
			d3.event.preventDefault();

			var r = this.projection.rotate();
			var m = d3.mouse(this.svg[0][0]);

			r[0] += (m[0] - this.mouseLast[0])*0.5;
			r[1] -= (m[1] - this.mouseLast[1])*0.1;
			r[0] = r[0]%360;
			r[1] = Math.min(Math.max(r[1], -90), 90);

			this.mouseLast = m;

			this.setProjection(this.projection.rotate(r));
		},

		mouseMoveFlat: function(){ //todo constrain movement vs scale
			//d3 SVG
			d3.event.preventDefault();

			var m = d3.mouse(this.svg[0][0]);

			this.translation[0] += (m[0] - this.mouseLast[0])/this.scale;
			this.translation[1] += (m[1] - this.mouseLast[1])/this.scale;

			this.mouseLast = m;

			this.setZoom();
		},

		clickZoomIn: function() {
			this.scale *= 3;

			this.setZoom(500);
		},

		clickZoomOut: function() {
			this.scale /= 3;

			this.setZoom(500);
		},

		clickReset: function() {
			this.resetZoom(500);
		},

		resize: function(_animate) {
			var animate = (_animate && typeof _animate !== 'object') || false; //if set and if not an object (jq event)
			var sphere = this.mode === "sphere";

			var w = this.$svg.width();
			var h, s;

			if(sphere){
				var h2 = Math.min(this.$svg.height()-130, w-20);
				var h3 = (this.$svg.height()-100) / 2 + 20;
				h = h3 + h2 / 2;
				s = (h2)/2 - 10;

				this.setProjection(
					d3.geo.orthographic()
						.precision(0)
						.clipAngle(85)
						.rotate([30,-10,0])
						.scale(s)
						.translate([
							w / 2,
							h3
						]), animate);

				this.zoomTo = null;
			}else{
				h = Math.min(Math.max(Math.min($(window).height()-400, 700),300), w / 2);
				s = h * 0.3;

				this.setProjection(
					d3.geo.mercator()
						.precision(0)
						.rotate([-11.5, 0])
						.scale(s)
						.translate([
							w / 2,
							h * 0.7
						]), animate);
			}

			if(animate){
				this.$spacer.clearQueue().stop()
					.delay(sphere ? 0 : 1000)
					.animate({
						height: h
					}, 1000);
			}else if(!this.isAnimating) {
				this.$spacer.clearQueue().stop().height(h);
			}

			this.resetZoom();
		},

		setProjection: function(_projection, _animate){
			var sphere = this.mode === "sphere";
			var _this = this;

			if(_animate){
				this.isAnimating = true;
				if(sphere){
					//from flat to sphere

					this.projection = _projection.clipAngle(180);
					this.path.projection(this.projection);

					this.countries
						.transition()
						.duration(1000)
						.attr("d", this.path);

					this.svg
						.transition()
						.duration(1000)
						.delay(1000)
						.tween("clipAngle", function() {
							return function(t) {
								_this.projection.clipAngle(180 - 95 * t);
								_this.path.projection(_this.projection);
								_this.countries.attr("d", _this.path);
							};
						});

					d3.transition()
						.duration(1000)
						.delay(1000)
						.each("end", function() {
							if(_this.isAnimating){
								_this.isAnimating = false;
								_this.resize();
							}
						});

					this.projection = _projection.clipAngle(85);
					this.path.projection(this.projection.precision(0.1));

					this.sphere
						.attr("d", this.path)
						.transition()
						.duration(1000)
						.style("opacity", 1);

					this.lines
						.attr("d", this.path)
						.transition()
						.duration(1000)
						.style("opacity", 0.3);
				}else{
					//from sphere to flat

					this.svg
						.transition()
						.duration(1000)
						.tween("clipAngle", function() {
							return function(t) {
								_this.projection.clipAngle(85 + 95 * t);
								_this.path.projection(_this.projection);
								_this.countries.attr("d", _this.path);
							};
						});

					this.sphere
						.transition()
						.duration(1000)
						.style("opacity", 0);

					this.lines
						.transition()
						.duration(1000)
						.style("opacity", 0);

					this.countries
						.transition()
						.duration(1000)
						.delay(1000)
						.attr("d", this.path.projection(_projection));

					d3.transition()
						.duration(1000)
						.delay(1000)
						.each("end", function() {
							_this.projection = _projection;
							if(_this.isAnimating){
								_this.isAnimating = false;
								_this.resize();
							}
						});
				}
			} else if(!this.isAnimating) {
				this.projection = _projection;
				this.path.projection(this.projection.precision(0));
				this.countries.attr("d", this.path);

				this.path.projection(this.projection.precision(0.1));
				this.sphere.attr("d", this.path);
				this.sphere.style("opacity", sphere ? 1 : 0);
				this.lines.attr("d", this.path);
				this.lines.style("opacity", sphere ? 0.3 : 0);
			}
		},

		resetZoom: function(_delay) {
			if(this.zoomTo) {
				//copy zoomTo, delete all but 1 under geometry.coordinates and find area - pick largest
				//for(var i=0; i < this.zoomTo.geometry.coordinates.length; i++){
				//	dbg(this.path.area(this.zoomTo.geometry.coordinates[i]));
				//}
				var b = this.path.bounds(this.zoomTo);

				this.translation = [
					-(b[1][0] + b[0][0]) / 2,
					-(b[1][1] + b[0][1]) / 2
				];
				this.scale = Math.min(0.8* Math.min(this.$svg.width() / (b[1][0] - b[0][0]), this.$spacer.height() / (b[1][1] - b[0][1])), 15);
			}else{
				this.scale = 1;
			}

			this.setZoom(_delay);
		},

		setZoom: function(_delay) {
			var w = this.$svg.width()/ 2,
				h = this.$spacer.height()/2;

			this.scale = Math.min(Math.max(Math.round(this.scale), 1), 15);

			if(this.scale === 1) {
				this.translation = [-this.$svg.width()/2, -this.$spacer.height()/2];
			}else{ //todo constrain movement
				//this.translation[0] = Math.min(this.translation[0], -w/this.scale);
			//	this.translation[0] = Math.max(this.translation[0], -(w*3)/this.scale);

				//this.translation[1] = Math.min(this.translation[1], -h/this.scale);
			//	this.translation[1] = Math.max(this.translation[1], -(h*3)/this.scale);
			}

			var c = (_delay) ? this.getCountriesAnimation(_delay) : this.countries;
			var a = c.attr("transform",
				"translate(" + w + "," + h + ")" +
				"scale(" + this.scale + ")" +
				"translate(" + this.translation[0] + "," + this.translation[1] + ")");

			if(_delay && c !== this.countries){
				this.isAnimating = true;
				var _this = this;
				a.each("end", function(){
					_this.isAnimating = false;
				});
			}

			this.svg.attr("class", ( (this.scale > 1) || (this.mode === 'sphere') ? "drag" : "" ) );
		},

		setMode: function() {
			var animate = this.mode && (this.mode !== this.model.mapModel.get('mode')); //animate if we have a mode set & not equal to model
			this.mode = this.model.mapModel.get('mode');

			this.$content.css({'position': (this.mode === "sphere" ? 'static' : 'relative')});

			this.resize(animate);

			$(".zoom", this.$buttons).toggle(this.mode === "flat");
			$(".icon-help", this.$buttons).attr('title', this.mode === "sphere" ?
				"Drag the globe to rotate.<br>Click for a more detailed breakdown" :
				"Click a country to select it.<br>Use the buttons to zoom in and out.<br>Drag to pan the map when zoomed in.");
		},

		setLegend: function() {
			var text = this.model.mapModel.get('legend');
			this.$legendText.text(text ? text : '');
		},

		setCountry: function() {
			var country = this.model.get('country');
			var iso = Utils.codeToIso(country);
			var duration = 1000;
			this.countries.classed("selected", false);

			if(country && iso){
				var path = this.countries.filter(function(d, i) { return d.id == iso; });
				path.classed("selected", true).each(function(){
					this.parentNode.appendChild(this);
				});
				if(typeof this.zoomTo === "undefined") duration = 0;
				this.zoomTo = path.data()[0];
			}else{
				this.zoomTo = null;
			}

			this.resetZoom(duration); //todo fix animation duration
		},

		setColours: function() {
			var data = this.model.mapModel.get('data');
			if(!data)
				return;
			var date = data[this.model.get('date')];
			if(!date)
				return;
			var _this = this;

			var maxPercentage = 0;
			for(var i in data){
				for(var j in data[i]){
					if(maxPercentage < data[i][j].percentage)
						maxPercentage = data[i][j].percentage;
				}
			}

			this.scaleDomain = [-1, 0, 0.1*maxPercentage, maxPercentage];
			this.colourScale.domain(this.scaleDomain);

			this.getCountriesAnimation(500, 'linear')
				.attr("fill", function(d,i){
					var code = Utils.isoToCode(d.id);

					if(date[code]){
						d.data = date[code];
						return _this.colourScale(d.data.percentage);
					}
					return _this.colourScale(-1);
				});

			this.legend.selectAll("text").remove();
			this.legend.append("text")
				.attr("x", 0)
				.attr("y", 15)
				.attr("text-anchor", "start")
				.text(Math.round(this.scaleDomain[1] * 100) + "%");
			this.legend.append("text")
				.attr("x", "100%")
				.attr("y", 15)
				.attr("text-anchor", "end")
				.text(Math.round(_this.scaleDomain[3] * 100) + "%");
			this.legend.append("svg:rect")
				.attr("width", "66%")
				.attr("height", 5)
				.attr("x", "17%")
				.attr("y", 8)
				.style("fill", "url(#legend-gradient)");
		},

		getCountriesAnimation: function(_duration, _ease){
			if(this.isAnimating)
				return this.countries;

			var _this = this;

			var c = this.countries.transition().duration(_duration);

			if(_ease) return c.ease(_ease);
			return c;
		}
	});

	return MapView;
});