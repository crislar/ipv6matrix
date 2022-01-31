define(function (require) {
	var Backbone = require('backbone');
	var Menu = JSON.parse(require('text!static/menu.json'));
	var routesList = {};

	var map = function menuMap(a, route){
		route = route || '';
		for (var key in a) {
			if (typeof a[key] === 'object') {
				map(a[key], route + key);
			} else {
				if (key === 'label'){
					route = route.replace(/^\//,"");
					route = route.replace(/\*$/,"");
					routesList[route] = a[key];
				}

			}
		}
	};

	map(Menu);

	routesList['/*'] = 'home';

	var Router = Backbone.Router.extend({
		routes: routesList
	});

	return Router;
});