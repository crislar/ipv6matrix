define(function (require) {
	var $ = require('jquery');
	var d3 = require('d3');
	var nv = require('nvd3');
    var _ = require('underscore');
	var LineChartView = require('views/graph/lineChartView');

	var buttonLineGraphView = LineChartView.extend({

		templateBottom: $('#template-graph-bottom').html(),
		templateButtons: _.template($('#template-data-buttons').html()),

		events: {
			"click #data-buttons td": "clickData"
		},

		initialize: function(){
            buttonLineGraphView.__super__.initialize.apply(this);

			this.$el.prepend(this.templateBottom);

			this.$dataButtons = $("table#data-buttons tr", this.$el);
			
			for (var data in this.columns) {
				this.$dataButtons.append(this.templateButtons({data: this.columns[data], label: this.formatTitle(this.columns[data])}));
			}

			this.chart.yAxis.tickFormat(d3.format(',f'));
			this.setButton();
		},

		clickData: function(_event) {
			if($(_event.currentTarget).hasClass("data")){
				this.column = $(_event.currentTarget).attr("data-type");
				this.dataUpdate();
				this.setButton();
            }
		},

		setButton: function() {
			$("td", this.$dataButtons).removeClass("active");
			$(".data[data-type='" + this.column + "']", this.$dataButtons).addClass("active");
			this.model.set('column', this.formatTitle(this.column));
		},

        formatTitle: function(d) {
            return(d);
        }
	});

	return buttonLineGraphView;
});