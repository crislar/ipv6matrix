define(function (require) {
	// var $ = require('jquery');
	var d3 = require('d3');
	// var nv = require('nvd3');
    // var _ = require('underscore');
	var ButtonGraphView = require('views/graph/buttonGraphView');

	var dualstackGraphView = ButtonGraphView.extend({
		column: 'dualstack',
        denominator: 'hosts',
		columns: ['hosts4', 'hosts6', 'dualstack'],

        initialize: function(){
            dualstackGraphView.__super__.initialize.apply(this);
            this.chart.style('expand').yAxis.tickFormat(d3.format(',.2%')).axisLabel('Host Distribution');
        },

        formatTitle: function(d) {
            switch(d) {
                case 'hosts6':
                    return 'IPv6 Only';
                case 'dualstack':
                    return 'Dual Stack';
                case 'noip':
                    return 'No IP';
                default:
                    return 'IPv4 Only';
            }
        }
	});

	return dualstackGraphView;
});