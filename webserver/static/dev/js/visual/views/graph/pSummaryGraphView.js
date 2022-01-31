define(function(require) {
	var $ = require('jquery');
	var d3 = require('d3');
    var utils = require('utils');
    var _ = require('underscore');
    var LineChartView = require('views/graph/lineChartView');

	var pSummaryGraphView = LineChartView.extend({

        initialize: function(_options) {
            if (_options.page === 'ping') {
                this.denominators = ['ping4','hosts'];
                this.columns = ['ping6','faster'];
            } else {
                this.denominators = ['hops4','hosts'];
                this.columns = ['hops6','fewer'];
            }

            pSummaryGraphView.__super__.initialize.apply(this);

            this.chart.yAxis.axisLabel('Percentage of Hosts');
        },

        dataUpdate: function() {
            var d = this.model.detailModel.get('data');
            var date;
            var data = [];

            for(var i = 0; i < this.columns.length; i++) data[this.columns[i]] = [];

            for (date in d) {
                var dateObj = new Date(date);

                for(var i = 0; i < this.columns.length; i++) {
                    var cNum = 0;
                    var dNum = 0;
                    
                    for (var j in d[date]) {
                        cNum += d[date][j][this.columns[i]];
                        dNum += d[date][j][this.denominators[i]];

                    }
                    data[this.columns[i]].push([dateObj, cNum/dNum]);
                }
            }

            var _data = [];
            var key;
            for (key in data) {
                _data.push({key: this.formatTitle(key), values: data[key]});
            }
            
            this.svg
                .datum(_data)
                .transition()
                .call(this.chart);

        },

        formatTitle: function(d) {
            switch(d) {
                case 'fewer':
                    return 'Fewer Hops on IPv6';
                case 'hops6':
                    return 'Hop Ratio (IPv6/IPv4)';
                case 'faster':
                    return 'Lower Ping on IPv6';
                case 'ping6':
                    return 'Ping Ratio (IPv6/IPv4)';
            }
        }

	});

	return pSummaryGraphView;
});