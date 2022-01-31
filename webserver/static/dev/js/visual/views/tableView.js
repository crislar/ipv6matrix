define(function (require) {
	var $ = require('jquery');
    var d3 = require('d3');
    var _ = require('underscore');
    var tablesorter = require('jquery.tablesorter');
	var Backbone = require('backbone');

	var TableView = Backbone.View.extend({
		template: $("#template-table").html(),
		initialize: function(_options){
			this.options = _options || {};
            this.$el.html(this.template);

            this.$table = $("#data-table", this.$el);
            this.$thead = $("thead", this.$table).find("tr#theader");
            this.$tsummary = $("thead", this.$table).find("tr#tsummary");
            this.$tbody = $("tbody", this.$table);
		},

		render: function() {
			this.listenTo(this.model.detailModel, "change:dateData", _.debounce(this.dataUpdate, 500));
            this.listenTo(this.model.detailModel, "change:columns", this.initTable);
            if (this.model.detailModel.get('dateData')) this.dataUpdate();
			return this;
		},

		remove: function() {
			Backbone.View.prototype.remove.call(this);
		},

        getHeader: function(){
            var cols = this.model.detailModel.get('columns');
            var html = '';
            for(var i = 0; i < cols.length; i++) {
                html += '<th>' + cols[i].header +
                    (cols[i].desc ? '<div class="icon-help" title="' + cols[i].desc + '"></div></th>' : '');
            }
            return html;
        },

        getSummary: function(){
            var cols = this.model.detailModel.get('columns');
            var html = '';
            for(var i = 0; i < cols.length; i++) {
                var summary = cols[i].summary[this.model.get('date')];
                if(summary){
                    html += '<th class="sorter-false">' + cols[i].summary[this.model.get('date')] + '</th>';
                }else{
                    html += '<th></th>';
                }
            }
            return html;
        },

        getBody: function(){
            var data = this.model.detailModel.get('dateData');
            var cols = this.model.detailModel.get('columns');
            var html = '';
            for(var row in data){
                html += '<tr><td>' + cols[0].format(row) + '</td>';
                for(var i = 1; i < cols.length; i++) html += '<td>' + cols[i].format(data[row][cols[i].name]) + '</td>';
                html += '</tr>';
            }
            return html;
        },

        initTable: function() {
            this.$thead.html(this.getHeader());
            this.$table.trigger("updateAll");
            if(!this.$table.get(0).config) this.$table.tablesorter();
        },

        dataUpdate: function(){
            this.$tbody.html(this.getBody());
            this.$tsummary.html(this.getSummary());

            if(this.$thead.find("th").size() === 0) {
                this.initTable();
            } else {
                this.$table.trigger("update");
            }
		}
	});

	return TableView;
});