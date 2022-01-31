define(function (require) {
    var d3 = require('d3');
    var _ = require('underscore');
    var tablesorter = require('jquery.tablesorter');
    var TableView = require('views/tableView');

	var CustomTableView = TableView.extend({
        getHeader: function(){
            var cols = this.options.columns;
            var html = '';
            for(var i = 0; i < cols.length; i++) {
                html += '<th>' + cols[i].header +
                    (cols[i].desc ? '<div class="icon-help" title="' + cols[i].desc + '"></div></th>' : '');
            }
            return html;
        },

        getSummary: function(){
            return '';
        },

        getBody: function(){
            var data = this.model.detailModel.get('dateData');
            data = _.values(data)[0];
            var cols = this.options.columns;
            var rows = this.options.rows;
            var html = '';
            var i, j;
            if (this.options.nested) {
                for(i = 0; i < rows.length; i++) {
                    html += '<tr><td>' + cols[0].format(rows[i]) + '</td>';
                    for(j = 1; j < cols.length; j++) html += '<td>' + cols[j].format(data[rows[i]][cols[j].suffix]) + '</td>';
                    html += '</tr>';
                }
            } else {
                for(i = 0; i < rows.length; i++) {
                    html += '<tr><td>' + cols[0].format(rows[i]) + '</td>';
                    for(j = 1; j < cols.length; j++) html += '<td>' + cols[j].format(data[rows[i]+cols[j].suffix]) + '</td>';
                    html += '</tr>';
                }
            }
            return html;
        }
	});

	return CustomTableView;
});