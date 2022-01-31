define(function (require) {
	var $ = require('jquery');
	var Backbone = require('backbone');

	var MenuView = Backbone.View.extend({
		el: "#nav ul",

		initialize: function(){
			this.render();
		},

		render: function(){
			$("li", this.$el).removeClass("active");
			
			var _this = this;

			$("li", this.$el).filter(function(){
				return $("a[href='" + _this.model.get('pageBase') + "']", this).length !== 0;
			}).addClass("active");
		}
	});

	return MenuView;
});