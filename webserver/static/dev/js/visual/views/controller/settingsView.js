define(function (require) {
	var $ = require('jquery');
	var Backbone = require('backbone');
	var jqueryTree = require('jquery.tree');

	var treeConfig = {
		collapseDuration: 100,
		expandDuration: 100,
		onCheck: {
			ancestors: 'checkIfFull',
			descendants: 'check'
		},
		onUncheck: {
			ancestors: 'uncheck'
		}
	};

	var GraphView = Backbone.View.extend({
		template: $("#template-settings").html(),

		events: {
			'click input[type="checkbox"]': "queryGenerate",
			'change #select-sample': "queryGenerate"
		},

		initialize: function () {
			this.$el.html(this.template);

			this.$treeTld = $("#tree-tld", this.$el);
			this.$treeType = $("#tree-type", this.$el);
			this.$selectSample = $("#select-sample", this.$el);

		},

		render: function(_delay) {
			this.delegateEvents();

			var delay = (_delay || 0) + 10;

			setTimeout(function(){
				$("#tree-type", this.$el).tree(treeConfig).show();

				setTimeout(function(){ //make async so initial render is instant
					$("#tree-tld", this.$el).tree(treeConfig).show();
				}, delay);
			}, 0);

			this.listenTo(this.model, "change:querySample", this.setSample);
			this.setSample();

			this.queryGenerate();

			return this;
		},

		queryGenerate: function() {
			//build tld list
			var tlds = [],
				types = [],
				sample = 0;

			if(!$(".all", this.$treeTld).prop("checked")){
				$('input[type="checkbox"][data-tld]:checked', this.$treeTld).each(function(){
					tlds.push($(this).attr('data-tld'));
				});
			}

			if(!$(".all", this.$treeType).prop("checked")){
				$('input[type="checkbox"][data-type]:checked', this.$treeType).each(function(){
					types.push($(this).attr('data-type'));
				});
			}

			sample = this.$selectSample.val();

			this.model.set({
				'queryTLDs': tlds,
				'queryTypes': types,
				'querySample': sample
			});
		},

		setSample: function () {
			this.$selectSample.val(this.model.get('querySample'));
		}
	});

	return GraphView;
});