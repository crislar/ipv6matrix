define(function (require) {
	// var $ = require('jquery');
	var d3 = require('d3');
	// var nv = require('nvd3');
    // var _ = require('underscore');
	var ButtonLineGraphView = require('views/graph/buttonLineGraphView');
    var utils = require('utils');

	var reachGraphView = ButtonLineGraphView.extend({

        column: 'reach6',
        denominator: 'hosts6',
        columns: ['reach4', 'reach6'],

        initialize: function(){
            reachGraphView.__super__.initialize.apply(this);
            this.chart.yAxis.tickFormat(d3.format('.2%'));
            this.chart.yAxis.axisLabel('Percentage of Hosts Reachable');
        },

        dataUpdate: function() {
            this.switchColumn();
            reachGraphView.__super__.dataUpdate.apply(this);
        },

        switchColumn: function() {
            switch (this.column) {
                case 'reach6':
                    this.denominator = 'hosts6';
                    break;
                case 'reach4':
                    this.denominator = 'hosts4';
                    break;
            }
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

	return reachGraphView;
});