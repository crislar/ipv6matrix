require.config({
	urlArgs: "bust=" + (new Date()).getTime(),
	baseUrl: '/js/visual',

	paths: {
		'jquery': '../lib/jquery',
		//'jquery.ui': '../lib/jquery-ui',
		'jquery.ui': '../lib/jquery-ui-1.10.3.custom',
        'jquery.tablesorter': '../lib/jquery.tablesorter',
        'jquery.tree': '../lib/jquery.tree.min', //using min as dev is multiple files
        'typeahead': '../lib/typeahead',
		'underscore': '../lib/underscore',
		'underscore.string': '../lib/underscore.string',
		'backbone': '../lib/backbone',
		'd3': '../lib/d3.v3',
		'text': '../lib/text',
		'topojson': '../lib/topojson',
		'nvd3': '../lib/nv.d3',
		'analytics': '../lib/backbone.analytics'
	},

	shim: {
		'backbone': {
			deps: ['underscore', 'jquery'],
			exports: 'Backbone'
		},
		'underscore': {
			exports: '_'
		},
		'underscore.string': {
			deps: ['underscore'],
			exports: '_.str'
		},
		'd3': {
			exports: 'd3'
		},
		'topojson': {
			exports: 'topojson'
		},
		'nvd3': {
			deps: ['d3'],
			exports: 'nv'
		},
		'jquery.ui': {
			deps: ['jquery']
		},
		'jquery.tree': {
			deps: ['jquery.ui']
		},
        'analytics': {
			deps: ['backbone']
		}
	}
});

require(['main']);