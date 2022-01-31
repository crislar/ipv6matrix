define(function (require) {
	var $ = require('jquery');
    var d3 = require('d3');
    var _ = require('underscore');
	var Backbone = require('backbone');
	var Utils = require('utils');

	var SliderView = Backbone.View.extend({
		template: $("#template-slider").html(),

		events : {
			"mousedown .handle" : "dragStart"
		},

		initialize: function(_options){
			this.controllerModel = _options.controllerModel;

			this.$el.html(this.template);

			this.$slider = $("#slider .inner", this.$el);
			this.$handle = $(".handle", this.$el);
			this.$label = $(".handle .label", this.$el);

			this.steps = 1; //number of dates / steps in data
		},

		render: function() {
			this.delegateEvents();

			if(this.model.mapModel.get('data')){
				this.dataUpdate();
			} else {
               this.resize();
            }

			this.listenTo(this.model.mapModel, "change:data", this.dataUpdate);
			this.listenTo(this.controllerModel, "change:animate", this.setAnimate);

			return this;
		},

		remove: function() {
			this.undelegateEvents();

			clearTimeout(this.animationRequest);

			this.$handle.stop();

			$(window).unbind("mousemove");
			$(window).unbind("mouseup");

			Backbone.View.prototype.remove.call(this);
		},

		dragStart: function(_event) {
			_event.preventDefault();

			clearTimeout(this.animationRequest);
			this.$handle.stop();

			$(window).mousemove(_.bind(this.drag, this));
			$(window).mouseup(_.bind(this.dragEnd, this));

			this.startDifference = this.$handle.position().left - _event.clientX;
		},

		dragEnd: function(_event) {
			_event.preventDefault();

			$(window).unbind("mousemove");
			$(window).unbind("mouseup");

			var _this = this;

			var step = Math.round(this.positionPerc*this.steps);
			this.setPosition(step/this.steps, 100);

			if(this.controllerModel.get('animate')){
				this.animate(5000);
			}
		},

		drag: function(_event) {
			_event.preventDefault();

			var p = (_event.clientX + this.startDifference) / this.sliderWidth;
			p = Math.min(Math.max(0, p), 1);

			this.setPosition(p);

			return false;
		},

		animate: function(_delay) {
			var _this = this;

			var delay = _delay || 1500;

			var p = this.positionPerc + 1/this.steps;
			if(p>1.01){
				p = 0;
				delay = 5000;
			}

			clearTimeout(this.animationRequest);

			if(this.controllerModel.get('animate')) {
				this.animationRequest = setTimeout(function(){
					_this.setPosition(p, 1000);
					_this.animate();
				}, delay);
			}
		},

		setAnimate: function() {
            clearTimeout(this.animationRequest);
			if(this.model.mapModel.get('data')){
				if(this.controllerModel.get('animate')){
					this.setPosition(0, 200);
					this.resize();
                    this.animate(1000);
				} else {
					this.setPosition(1, 200);
					this.resize();
				}
			}
		},

		setPosition: function(_pos, _duration) {
			this.positionPerc = _pos;

			if(_duration){
				this.$handle.stop().animate(
					{
						"left": _pos * this.sliderWidth + "px"
					},
					{
						duration: _duration
						//easing: "easeInOutSine"
					}
				);
			}else{
				this.$handle.css({"left": _pos * this.sliderWidth + "px"});
			}

			var step = Math.round(this.positionPerc*this.steps);

			if(this.dates && step >= 0 && step <= this.steps){
				var date = this.dates[step];

				this.model.set('date', date);

				this.$label.text(Utils.formatDate(date));
			}
		},

		resize: function() {
			this.sliderWidth = this.$slider.width() - this.$handle.width();
			this.setPosition(this.positionPerc, 200);

			var _this = this;
			if(this.dates){
				d3.select(this.el).select(".ticks").selectAll(".line").remove();
				var a = d3.select(this.el).select("div.ticks").selectAll("div.line")
					.data(this.dates)
					.enter().append("div")
					.attr('class', 'line')
					.style('left', function(d, i) { return (_this.sliderWidth / _this.steps) * i + (_this.$handle.width()/2) + 'px';});
			}
		},

		dataUpdate: function(){
			var _this = this;

			this.dates = [];
			for(var k in this.model.mapModel.get('data')){
				this.dates.push(k);
			}

			this.dates.sort(function(a,b){ //todo move somma di dutty stuff outa hizzzerk
				var c = new Date(a);
				var d = new Date(b);
				return c<d?-1:c>d?1:0;
			});

			this.model.set('date', this.options.animate? this.dates[0] : _.last(this.dates) );
			this.steps = this.dates.length-1;

			$(".tick.left", this.$el).text(Utils.formatDate(this.dates[0]));
			$(".tick.right", this.$el).text(Utils.formatDate(_.last(this.dates)));
			
			this.setAnimate();
		}
	});

	return SliderView;
});