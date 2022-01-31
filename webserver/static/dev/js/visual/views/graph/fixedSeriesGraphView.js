define(function (require) {
	var $ = require('jquery');
	var d3 = require('d3');
	var nv = require('nvd3');
    var _ = require('underscore');
	var StackedAreaChartView = require('views/graph/stackedAreaChartView');

	var fixedSeriesGraphView = StackedAreaChartView.extend({

		series: {
			'hosts4': 'IPv4 Only',
			'hosts6': 'IPv6 Only',
			'dualstack': 'Dual Stack',
			'noip': 'No IP'
		},

		initialize: function(_options){
            if(_options && _options.series)
                this.series = _options.series;
			fixedSeriesGraphView.__super__.initialize.apply(this);

			this.chart.style('expand').yAxis.tickFormat(d3.format(',')).axisLabel('Host Distribution');
		},

		dataUpdate: function() {
			var d = this.model.detailModel.get('data');
			var date;
			var sum = {};
			var data = {};

			for (date in d) {
                var objDate = new Date(date);

                for(var group in d[date]) {
                    for (var s in this.series) {
                    	if (!sum[date]) sum[date] = {};
                    	if (!sum[date][s]) sum[date][s] = 0;
                    	sum[date][s] += d[date][group][s];
                    }
                }

                for (var s in this.series) {
                	if (!data[s]) data[s] = [];
            		data[s].push([objDate, sum[date][s]]);
                }
			}

			var _data = [];
			for (var s in this.series) {
				_data.push({key: this.series[s], values: data[s]});
			}

			this.svg
				.datum(_data)
				.call(this.chart);
		}
	});

	return fixedSeriesGraphView;
});