define(function (require) {
    var $ = require('jquery');
    var _ = require('underscore');
	var Backbone = require('backbone');
	var Utils = require('utils');

	var SideView = Backbone.View.extend({
		el: "#view-title",
		titleTemplate: _.template($("#template-side-title").html()),
		apiTemplate: _.template($("#template-side-api").html()),

		initialize: function () {
			this.listenTo(this.model, "change:routeLabel", this.setTitle);
			this.listenTo(this.model, "change:title change:country", this.setTitle);
			this.listenTo(this.model, "change:routeLabel", this.setDesc);
			this.listenTo(this.model, "change:country change:domain change:detailTitle", this.setDetailTitle);
			this.listenTo(this.model, "change:date", this.setDate);
			this.listenTo(this.model.mapModel, "change:loadUrl", this.setApi);
			this.listenTo(this.model.detailModel, "change:loadUrl", this.setApi);

			this.setTitle();
			this.setDetailTitle();
			this.setDate();
			this.setDesc();
			this.setApi();
		},

		setTitle: function() {
			//set title, make link if not at pageBase
			var html = '',
				text = '';
			if(this.model.get('title') === 'country'){
				html = text = Utils.codeToName(this.model.get('country')) + " (" + this.model.get('country') + ")";
			}else{
				text = $("#info-title-" + this.model.get('routeLabel')).html();
				html = (window.location.pathname === this.model.get('pageBase')) ?
					text :
					"<a href='" + this.model.get('pageBase') + "'> " + text + "</a>"
			}

			$(".main", this.$el).html(html);
			window.document.title = 'IPv6Matrix | ' + text;
		},

		setDetailTitle: function() {
			var html = '';

			switch(this.model.get('detailTitle')){
				case 'country':
					var c = this.model.get('country');
					html = this.titleTemplate({
						sub: 'Country',
						title: (c ? '<a href="/country-' + c + '">' + Utils.codeToName(c) + ' (' + c + ')</a>' : 'Global')
					});
					break;
				case 'domain':
					var d = this.model.get('domain');
					html = this.titleTemplate({
						sub: 'Domain',
						title: d ? d : 'Global'
					});
					break;
				default:
					break;
			}

			$(".detail", this.$el).html(html);
		},

		setDate: function() {
			//set date title based on model date Date() object
			var html = '';
			if(this.model.get('date')) {
				html = this.titleTemplate({
					sub: 'Date',
					title: Utils.formatDate(this.model.get('date'))
				});
			}

			$(".date", this.$el).html(html);
		},

		setDesc: function() {
			var desc = $("#info-desc-" + this.model.get('routeLabel')).html();
			var html = this.titleTemplate({
				sub: 'Info',
				title: desc
			});
			$(".desc", this.$el).html(html);
		},

		setApi: function() {
			var url = (this.model.detailModel.get('loadUrl') || this.model.mapModel.get('loadUrl'));
			var html = '';
			if(url){
				url = url;
				var cleanUrl = url.indexOf('?') > 0 ? url.substring(0, url.indexOf('?')) : url;
				var html = this.titleTemplate({
					sub: 'Currently displaying data from:',
					title:  '<a data-bypass href="' + this.model.get('apiNode') + "data" + url + '">/data' + cleanUrl + '</a>'
				});
				html += this.apiTemplate({
					json: this.model.get('apiNode') + "json" + url,
					xml: this.model.get('apiNode') + "xml" + url,
					html: this.model.get('apiNode') + "html" + url,
					csv: this.model.get('apiNode') + "csv" + url,
				});
			}
			$(".api", this.$el).html(html);
		}
	});

	return SideView;
});