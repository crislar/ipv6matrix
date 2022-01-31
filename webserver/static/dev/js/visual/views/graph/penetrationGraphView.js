define(function (require) {
	var $ = require('jquery');
	var d3 = require('d3');
	var nv = require('nvd3');
	var utils = require('utils');
    var _ = require('underscore');
	var StackedAreaChartView = require('views/graph/stackedAreaChartView');

	var penetrationGraphView = StackedAreaChartView.extend({

		dataUpdate: function() {
            switch (this.page){
                case 'country':
					this.column = 'hosts6';
					this.denominator = 'hosts';
					break;
                case 'domains':
                    this.column = 'domains6';
                    this.denominator = 'domains';
                    break;
				case 'search':
                    this.column = 'www_hosts6';
                    this.denominator = 'www_hosts';
                    break;
				default : //hosts
					this.page = 'hosts';
					this.column = 'hosts6';
					this.denominator = 'hosts';
					break;
            }

			this.chart.yAxis
				.axisLabel('Percentage IPv6 ' + this.page.charAt(0).toUpperCase() + this.page.slice(1));

            penetrationGraphView.__super__.dataUpdate.apply(this);
		}
	});

	return penetrationGraphView;
});