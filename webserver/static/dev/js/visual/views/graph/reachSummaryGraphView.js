define(function (require) {
	var $ = require('jquery');
	var d3 = require('d3');
	var nv = require('nvd3');
    var _ = require('underscore');
    var LineChartView = require('views/graph/lineChartView');

	var reachSummaryGraphView = LineChartView.extend({

        initialize: function() {
            reachSummaryGraphView.__super__.initialize.apply(this);

            this.chart.yAxis.axisLabel('Percentage of Hosts Reachable');
        },

        dataUpdate: function() {

            var d = this.model.detailModel.get('data');
            var date;
            var data = [];
            data.reach4 = [];
            data.reach6 = [];

            for (date in d) {
                var dateObj = new Date(date);
                var num4 = 0;
                var num6 = 0;
                var tot4 = 0;
                var tot6 = 0;

                for(var group in d[date]) {
                    num4 += d[date][group].reach4;
                    num6 += d[date][group].reach6;
                    tot4 += d[date][group].hosts4;
                    tot6 += d[date][group].hosts6;
                }

                data.reach4.push([dateObj, num4/tot4]);
                data.reach6.push([dateObj, num6/tot6]);
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
                case 'reach6':
                    return 'IPv6 Host Reachability';
                case 'reach4':
                    return 'IPv4 Host Reachability';
            }
        }
	});

	return reachSummaryGraphView;
});