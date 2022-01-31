define(function (require) {
	var Backbone = require('backbone');
	var d3 = require('d3');
    var _ = require('underscore');

	var DetailModel = Backbone.Model.extend({
		defaults: {
			"dataUrl": null, //currently loaded data url
			"loadUrl": null, //selected data url to load
			"data": null, //loaded data
            "dateData": null, //loaded data for specific date
            "processData": null, //function run on incoming data
            "groups": null, //list of all possible data groupings
			"group": null, //current grouping
            "columns": null, //column definitions & summaries for current data set
            "genColumns": null //function run new data, returns new column definitions
        },

		initialize: function(){
			//this.listenTo(this, "change:groups", this.setGroup);
		},

		setGroup: function() {
			//set current group to first one by default
			if(this.get('groups') && this.get('groups').length)
				this.set('group', this.get('groups')[0]);
		},

        setData: function(_data, _url) {
            var genColumn = function(col) {
                if (col.aggFunc) {
                    if (_.isArray(col.aggFunc)) {
                        var s = '';
                        for(var i=0; i<col.aggFunc.length; i++) {
                            s += col.aggFunc[i](d3.values(_data[date]),col)+'<br>';
                        }
                        col.summary[date] = s;
                    } else {
                        col.summary[date] = col.aggFunc(d3.values(_data[date]),col);
                    }
                }
            };

            //Do nothing if this data is no longer requested or if we already have it
            if(_url !== this.get('loadUrl') || _url === this.get('dataUrl') || !this.get('group'))
                return;

			this.get('processData')(_data);

            //Get column definitions, run column aggregate functions
            var cols = this.get('genColumns')(this.get('group'));
            for (var date in _data) {
                cols.forEach(genColumn);
            }

            //Set new properties and notify listeners
            this.set({'dataUrl': _url, 'data': _data, 'columns': cols});
        }
	});

	return DetailModel;
});