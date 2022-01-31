define(function (require) {
	var $ = require('jquery');
	var Backbone = require('backbone');
	var analytics = require('analytics');

	var Router = require('routers/web-router');
	var MainView = require('views/mainView');

	(function() {
		var lastTime = 0;
		var vendors = ['webkit', 'moz'];
		for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
			window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
			window.cancelAnimationFrame =
				window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
		}

		if (!window.requestAnimationFrame)
			window.requestAnimationFrame = function(callback, element) {
				var currTime = new Date().getTime();
				var timeToCall = Math.max(0, 16 - (currTime - lastTime));
				var id = window.setTimeout(function() { callback(currTime + timeToCall); },
					timeToCall);
				lastTime = currTime + timeToCall;
				return id;
			};

		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = function(id) {
				clearTimeout(id);
			};

		window.dbg = window.DEBUG ? console.log.bind(console) : function(){};
	}());

	$(function() {
		var router = new Router();
		var mainView = new MainView(router);

		Backbone.history.start({pushState: true});

		$(document).on("click", "a:not([data-bypass])", function(_event) {
			var href = { prop: $(this).prop("href"), attr: $(this).attr("href") };
			var root = location.protocol + "//" + location.host;

			if (href.prop && href.prop.slice(0, root.length) === root) {
				_event.preventDefault();
				Backbone.history.navigate(href.attr, true);
			}
		});
	});
});