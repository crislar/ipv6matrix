define(function (require) {
	var $ = require('jquery');
	var d3 = require('d3');
	var nv = require('nvd3');
    var _ = require('underscore');
	var ButtonLineGraphView = require('views/graph/buttonLineGraphView');

	var PGraphView = ButtonLineGraphView.extend({

        initialize: function(_options){
            if (_options.page === 'ping') {
                this.column = 'faster';
                this.columns = ['faster', 'ping6'];
            } else {
                this.column = 'fewer';
                this.columns = ['fewer', 'hops6'];
            }

            PGraphView.__super__.initialize.apply(this);
        },

        dataUpdate: function () {
            switch (this.column) {
                case 'fewer':
                    this.denominator = 'hosts';
                    this.chart.yAxis.axisLabel('Percentage of Hosts with Fewer Hops on IPv6').tickFormat(d3.format('.2%'));
                    break;
                case 'hops6':
                    this.denominator = 'hops4';
                    this.chart.yAxis.axisLabel('IPv6 Hops / IPv4 Hops').tickFormat(d3.format('.3f'));
                    break;
                case 'faster':
                    this.denominator = 'hosts';
                    this.chart.yAxis.axisLabel('Percentage of Hosts with Lower Ping on IPv6').tickFormat(d3.format('.2%'));
                    break;
                case 'ping6':
                    this.denominator = 'ping4';
                    this.chart.yAxis.axisLabel('IPv6 Ping / IPv4 Ping').tickFormat(d3.format('.3f'));
                    break;
            }
            PGraphView.__super__.dataUpdate.apply(this);
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

	return PGraphView;
});