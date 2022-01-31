/*
 * Web
 */
var web = {};
var menu = require('../static/dev/js/visual/static/menu.json');
var tlds = require('../static/dev/js/visual/static/tlds.json');
web.menu = [];


//route map
module.exports = function(app){

	web.map = function menuMap(a, route){
		route = route || '';
		for (var key in a) {
			if (typeof a[key] === 'object') {
				web.map(a[key], route + key);
			} else {
				if (key === 'label') {
					if (process.env.NODE_ENV === 'development') console.log('get %s', route);
					app.get(route.replace(/\*$/, ""), web.home);
				} else if (key === 'name') {
					web.menu.push({'name': a[key], 'url': route.replace(/\*$/, "")});
				}

			}
		}
	};

	web.map(menu);

	app.map({
		'/about': {
			get: web.pug('about', {label: 'About', section: 'about'})
		},
		'/api': {
			get: web.pug('api', {label: 'API', section: 'api'})
		},
		'/credits': {
			get: web.pug('credits', {label: 'Credits', section: 'credits'})
		},
		'/': {
			get: web.home
		},
		'/*': {
			get: web.error
		}
	});
};

//web queries


web.navLinks = [
	{ label: 'matrix', path: '/' },
	{ label: 'about', path: '/about' },
	{ label: 'api', path: '/api' },
	{ label: 'credits', path: '/credits' }
];

web.pug = function(page, obj) {
	return function(req, res) {
		obj.navLinks = web.navLinks;
		obj.men = web.menu;
		obj.path = req.path;

		res.render(page, obj);
	};
};

web.home = web.pug('index', {label: '', section: 'matrix', tlds: tlds[0]});

web.error = function(req, res){
	return res.status(404).send(req.originalUrl + " not found");
};