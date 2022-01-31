const express = require('express');
const subdomains = require('express-subdomains');
const path = require('path');
const serveFavicon = require('serve-favicon');
const methodOverride = require('method-override');
const morgan = require('morgan');
const errorHandler = require('errorhandler');

const nodeUserGid = "www-data";
const nodeUserUid = "www-data";

const app = express();


//// configure 
app.set('views', __dirname + '/views');
app.set('view engine', 'pug');
app.set('view cache');
app.set('strict routing');
app.use(serveFavicon(__dirname + '/static/graphics/favicon.png'));
app.use(express.json());
app.use(methodOverride());
app.use(subdomains.middleware);

if (process.env.NODE_ENV === 'development') {
	app.set('port', process.env.PORT || 3000);
	app.use(morgan('dev'));
	//app.use(sass_middleware({src: __dirname, debug: true}));
	app.use(express.static(path.join(__dirname, 'static', 'dev')));
	app.use(errorHandler());
} else {
	app.set('port', process.env.PORT || 3000);
	//app.use(sass_middleware({src: path.join(__dirname, 'static', 'deploy') }));
	app.use(express.static(path.join(__dirname, 'static', 'deploy')));
}
//// end configure


subdomains
	.use('data')
	.use('json')
	.use('xml')
	.use('html')
	.use('csv')
	.use('');

app.map = function(a, route){
	route = route || '';
	for (var key in a) {
		switch (typeof a[key]) {
			case 'object':
				app.map(a[key], route + key);
				break;
			case 'function':
				if (process.env.NODE_ENV === 'development') console.log('%s %s', key, route);
				app[key](route, a[key]);
				break;
		}
	}
};

if(process.env.NODE_ENV !== 'web')
	require('./routes/data')(app);
if(process.env.NODE_ENV !== 'api')
	require('./routes/web')(app);

app.locals.title = 'IPv6Matrix',
app.locals.description = 'Tracking IPv6 connectivity around the world',
app.locals.author = 'University of Southampton GDP 11',
app.locals.debug = (app.get('env') === "dev");


app.listen(app.get('port'), '::', 511, function(){
	console.log('Node running as NODE_ENV ' + process.env.NODE_ENV);
	console.log('Express server listening on port ' + app.get('port'));
	if (app.get('env') !== "dev") {
		if ('setgid' in process && 'setuid' in process) {
			process.setgid(nodeUserGid);
			process.setuid(nodeUserUid);
		}
	}
});