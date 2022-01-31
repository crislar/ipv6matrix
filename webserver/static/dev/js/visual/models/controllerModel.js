define(function (require) {
	var Backbone = require('backbone');

	var ControllerModel = Backbone.Model.extend({
		defaults: {
			"animate": false,
			"groups": true,
			"settings": true
		}
	});

	return ControllerModel;
});