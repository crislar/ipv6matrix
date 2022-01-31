define(function (require) {
	var ReachGraphView = require('views/graph/reachGraphView');
    var _ = require('underscore');

	var domainReachGraphView = ReachGraphView.extend({
        getChartData: function(d) {
            var series = ['HTTP','HTTPS','SMTPS'];
            var date;
            var data = [];

            for (date in d) {
                var dateObj = new Date(date);
                var domain = _.values(d[date])[0];
                for (var g in series) {
                    var group = series[g];
                    if (!data[group]) data[group] = [];
                    data[group].push([dateObj, domain[group][this.column]/domain[group][this.denominator]]);
                }
            }

            return data;
        }
	});

	return domainReachGraphView;
});