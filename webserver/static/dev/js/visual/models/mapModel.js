define(function (require) {
	var Backbone = require('backbone');
	var d3 = require('d3');

	var MapModel = Backbone.Model.extend({
		defaults: {
            "dataUrl": null, //currently loaded data url
            "loadUrl": null, //selected data url to load
            "data": null, //loaded data
            "dateData": null, //loaded data for specific date
            "processData": null, //function run on incoming data
            "group": "country", //group by type
            "mode": "sphere",
            "legend": null
		},

		initialize: function(){
		},

		setData: function(_data, _url) {
            //Do nothing if this data is no longer requested or if we already have it
			if(_url !== this.get('loadUrl') || _url === this.get('dataUrl'))
				return;

            //Run processData defined for the current route on new data
			if(this.get('processData')) this.get('processData')(_data);

            //Set new properties and notify listeners
			this.set({'dataUrl': _url, 'data': _data});
		}
	});

	return MapModel;
});