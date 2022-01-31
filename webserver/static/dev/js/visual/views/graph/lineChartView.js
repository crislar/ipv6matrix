define(function(require) {
	var $ = require('jquery');
	var Backbone = require('backbone');
	var d3 = require('d3');
    var utils = require('utils');
    var _ = require('underscore');
	var nv = require('nvd3');

	var lineChartView = Backbone.View.extend({
		template: $("#template-graph").html(),
        numSeries: 5,

        column: 'faster',
        denominator: 'hosts',

		initialize: function(_options){
			this.$el.html(this.template);
			this.$svg = $("svg.graph", this.$el);
			this.svg = d3.select(this.el).select("svg.graph");

			var colors = d3.scale.category10();
			var keyColor = function(d, i) {return colors(i);};

			var chart = nv.models.lineChart()
				.color(keyColor)
				.useInteractiveGuideline(true)
				.x(function(d) { return d[0]; })
                .y(function(d) { return d[1]; })
                .transitionDuration(200)
                .margin({top:0, right:10, bottom:45, left:80});

			chart.xAxis
				.axisLabel('Date')
				.showMaxMin(false)
				.tickFormat(function(d) { return d3.time.format('%d %b %y')(new Date(d)); });

			chart.yAxis
				.showMaxMin(true)
				.tickFormat(d3.format(',.2%'));
			
			nv.addGraph(function() {
				nv.utils.windowResize(chart.update);

				return chart;
			});

			this.chart = chart;
			this.svg.datum([]).transition().call(this.chart);
		},

		render: function(){
            var _dataUpdate = function() {
                if (this.model.detailModel.get('data')) this.dataUpdate();
            };
			this.resize();

			if(this.model.detailModel.get('data')){
				this.dataUpdate();
			}

			this.listenTo(this.model.detailModel, "change:data", _dataUpdate);
			this.listenTo(this.model, "change:date", this.dateUpdate);

			return this;
		},

		resize: function() {
			this.$svg.height(this.$svg.width()*0.5);
		},

		remove: function() {
            //TODO: remove nv graph? remove nv.utils.windowResize?
			Backbone.View.prototype.remove.call(this);
		},

        getSeries: function(num,d, column) {
            var mostRecentData = d[_.keys(d)[_.keys(d).length - 1]];//TODO: assumes data is sorted by date, is this a valid assumption?
            var keys = _.keys(mostRecentData);

            keys = _.sortBy(keys, function(c){ return -mostRecentData[c][column]; });
            return keys.slice(0,num);
        },

        dataUpdate: function() {
            var data = this.getChartData(this.model.detailModel.get('data'));
            var _data = [];
            var key;
            if (this.model.detailModel.get('group') === 'country'){
                for (key in data) {
                    _data.push({key: utils.codeToName(key), values: data[key]});
                }
            } else {
                for (key in data) {
                    _data.push({key: key, values: data[key]});
                }
            }

            this.svg
                .datum(_data)
                .transition()
                .call(this.chart);

        },

        getChartData: function(d) {
            var series = this.getSeries(this.numSeries,d,this.denominator);
            var date;
            var data = [];

            for (date in d) {
                var dateObj = new Date(date);

                for(var group in d[date]) {
                    if (series.indexOf(group) >= 0) {

                        var dataNum = d[date][group][this.column];
                        if (!data[group]) data[group] = [];
                        data[group].push([dateObj, dataNum/d[date][group][this.denominator]]);
                    }
                }

                for (var g in series) {

                    if (_.keys(d[date]).indexOf(series[g]) < 0) {
                        if (!data[series[g]]) data[series[g]] = [];
                        data[series[g]].push([dateObj, 0]);
                    }
                }
            }

            return data;
        },


		dateUpdate: function() {}

	});

	return lineChartView;
});