define(function (require) {
	var $ = require('jquery');
    var _ = require('underscore');
	var Backbone = require('backbone');
    var Utils = require('utils');

	var PanelView = Backbone.View.extend({
		template: $("#template-panel").html(),
		initialize: function(_options){
            this.options = _options || {views:[]};
            this.$el.html(this.template);
            this.$panel = $(".panel", this.$el);
            for(var i = 0; i < this.options.views.length; i++){
                this.$panel.append(this.options.views[i].$el);
            }
		},

		render: function() {
			this.renderTitle();
            for(var i = 0; i < this.options.views.length; i++){
                var view = this.options.views[i];
                view.render();
            }
            this.listenTo(this.model, "change:date change:column change:country change:domain", this.renderTitle);
			this.listenTo(this.model.detailModel, "change:group", this.renderTitle);
			return this;
		},

		renderTitle: function() {
			$(".heading .title", this.$el).text(
				_.template(this.options.title)({
					date: Utils.formatDate(this.model.get('date')),
					group: Utils.formatGroupTitle(this.model.detailModel.get('group')),
					country: Utils.codeToName(this.model.get('country')),
					column: this.model.get('column'),
					domain: this.model.get('domain')
				})
			);
			$(".heading .icon-help", this.$el).attr('title', this.options.desc || '');
		},

		remove: function() {
            Backbone.View.prototype.remove.call(this);
            for(var i = 0; i < this.options.views.length; i++){
                var view = this.options.views[i];
                view.remove();
            }
        }
	});

	return PanelView;
});