define(function (require) {
	var Backbone = require('backbone');
	var d3 = require('d3');
    var MapModel = require('models/mapModel');
    var DetailModel = require('models/detailModel');

	var ViewModel = Backbone.Model.extend({
		defaults: {
			"apiNode": "/", //node API location
			"apiBase": null, //current API request
			"pageBase": "/", //current page
			"routeLabel": null, //current route label, can't call it route :(
			"title": null,
			"detailTitle": null,
			"date": null,
			"country": null,
			"domain": null,
			"column": null,
			"queryTLDs": null,
			"queryTypes": null,
			"querySample": 50
		},

        mapModel: new MapModel(),
        detailModel: new DetailModel(),

		initialize: function(){
            this.listenTo(this, "change:date", this.dateUpdate);
			this.listenTo(this.mapModel, "change:loadUrl", this.loadMapData);
            this.listenTo(this.detailModel, "change:loadUrl", this.loadDetailData);
            this.listenTo(this, "change:apiBase change:country change:queryTLDs change:queryTypes change:querySample", this.setLoadUrl);
            this.listenTo(this.detailModel, "change:group", this.setLoadUrl);
		},

		loadMapData: function() {
			var _this = this;
			var mapUrl = this.mapModel.get('loadUrl');
			if(!mapUrl || !mapUrl.length) return;

			d3.json(
				this.get('apiNode') + "data" + mapUrl,
				function(_error, _data){
					dbg("MAP LOAD " + mapUrl);
					_this.setData(_data, mapUrl);
				}
			);
		},

		loadDetailData: function() {
			var _this = this;
			var detailUrl = this.detailModel.get('loadUrl');
			if(!detailUrl || !detailUrl.length) return;

			if(detailUrl === this.mapModel.get('dataUrl')) {
				this.setData(this.mapModel.get('data'), detailUrl);
			}else if(detailUrl !== this.mapModel.get('loadUrl')){
				d3.json(
					this.get('apiNode') + "data" + detailUrl,
					function(_error, _data){
						dbg("DETAIL LOAD " + detailUrl);
						_this.setData(_data, detailUrl);
					}
				);
			}
		},

		setData: function(_data, _url) {
			this.mapModel.setData(_data, _url);
			this.detailModel.setData(_data, _url);
            if(this.detailModel.get('data')) this.detailModel.set('dateData', this.detailModel.get('data')[this.get('date')]);
		},

		setLoadUrl: function(model) {
            if(!this.get('apiNode') || !this.get('apiBase')) return;
            //dbg('setLoadUrl:');
            //dbg(model.changedAttributes());
			var baseUrl = this.get('apiBase');

			var postUrls = [];
			if(this.get('queryTLDs') && this.get('queryTLDs').length)
				postUrls.push('tlds=' + this.get('queryTLDs').join(','));
			if(this.get('queryTypes') && this.get('queryTypes').length)
				postUrls.push('types=' + this.get('queryTypes').join(','));
			if(this.get('querySample') && this.get('querySample')!==0)
				postUrls.push('min-sample=' + this.get('querySample'));

			var postUrl = (postUrls.length ? '?' + postUrls.join("&") : '');

			this.mapModel.set('loadUrl', baseUrl + '/group-' + this.mapModel.get('group') + postUrl);

			var detailUrl = null;
			if (this.detailModel.get('group')){
				detailUrl = baseUrl +
                    '/group-' + this.detailModel.get('group') +
                    (this.get('country') ? '/country-' + this.get('country') : '') +
                    postUrl;
			}
			this.detailModel.set('loadUrl', detailUrl);
            dbg('mapUrl:'+this.mapModel.get('loadUrl')+' detailUrl: '+this.detailModel.get('loadUrl'));

		},

        dateUpdate: function() {
            var date = this.get('date');
            if(!date) return;
            if(this.detailModel.get('data')) this.detailModel.set('dateData', this.detailModel.get('data')[date]);
        }
	});

	return ViewModel;
});