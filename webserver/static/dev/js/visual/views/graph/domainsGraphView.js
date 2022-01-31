define(function (require) {
	var $ = require('jquery');
	var d3 = require('d3');
	var nv = require('nvd3');
    var _ = require('underscore');
	var ButtonGraphView = require('views/graph/buttonGraphView');

	var dualstackGraphView = ButtonGraphView.extend({
		column: 'domains6',
        denominator: 'domains',
		columns: ['domains6', 'www', 'ns', 'mx', 'ntp'],

        initialize: function(){
            dualstackGraphView.__super__.initialize.apply(this);
            this.chart.style('stack').yAxis.axisLabel('Percentage of IPv6 Enabled Domains').tickFormat(d3.format(',.2%'));
        },

        formatTitle: function(d) {
            switch(d) {
                case 'domains6':
                    return 'Any';
                case 'www':
                    return 'WWW';
                case 'ns':
                    return 'NS';
                case 'mx':
                    return 'MX';
                case 'ntp':
                    return 'NTP';
                default:
                    return 'Domains';
            }
        },

        dataUpdate: function() {
            this.chart.yAxis.axisLabel('Percentage of Domains with ' + this.formatTitle(this.column) + ' IPv6 Enabled');

            dualstackGraphView.__super__.dataUpdate.apply(this);
        },

        formatSeries: function(s) {}
	});

	return dualstackGraphView;
});