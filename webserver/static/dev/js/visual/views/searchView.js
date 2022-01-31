define(function (require) {
	var $ = require('jquery');
    var typeahead = require('typeahead');
	var Backbone = require('backbone');
	var _ = require('underscore');

	var SearchView = Backbone.View.extend({
		template: $("#template-search").html(),
		initialize: function(){
            this.$el.html(this.template);
            this.$input = $("input#domainsearch", this.$el);
            this.$input.typeahead({
                name: 'domains',
                limit: 20,
                //prefetch: '/js/visual/static/slim-2.json',
                //valueKey: 'name'
                remote: this.model.get('apiNode') + "data" + '/domain/search-%QUERY'
            });
		},

		render: function() {
			//$(window).bind("resize", _.bind(this.resize, this));

			this.$input.on("typeahead:selected", _.bind(this.setSelected, this));
			this.$input.on("typeahead:autocompleted", _.bind(this.setSelected, this));

			if(this.model.get('domain')){
				this.$input.val(this.model.get('domain'));
			}

			return this;
		},

		remove: function() {
            this.$input.typeahead('destroy');
			Backbone.View.prototype.remove.call(this);
		},

		setSelected: function(_event, _datum) {
			var domain = _datum.value;
			dbg(domain);

			this.model.set('domain', domain);
			Backbone.history.navigate(this.model.get('pageBase') + "-" + domain, {trigger: true});
		}

	});

	return SearchView;
});