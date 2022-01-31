define(function (require) {
	var Backbone = require('backbone');

	var ViewModel = require('models/viewModel');
	var ControllerModel = require('models/controllerModel');
	
    var PanelView = require('views/panelView');
	var MapView = require('views/mapView');
	var ControllerView = require('views/controller/controllerView');
    var TableView = require('views/tableView');
    var CustomTableView = require('views/customTableView');
    var SearchView = require('views/searchView');
    var MenuView = require('views/menuView');
    var SideView = require('views/sideView');

    var ReachGraphView = require('views/graph/reachGraphView');
    var DomainReachGraphView = require('views/graph/domainReachGraphView');
    var ReachSummaryGraphView = require('views/graph/reachSummaryGraphView');
    var PGraphView = require('views/graph/pGraphView');
    var PSummaryGraphView = require('views/graph/pSummaryGraphView');
    var FixedSeriesGraphView = require('views/graph/fixedSeriesGraphView');
    var PenetrationGraphView = require('views/graph/penetrationGraphView');
    var DualstackGraphView = require('views/graph/dualstackGraphView');
    var DomainsGraphView = require('views/graph/domainsGraphView');

    var _ = require('underscore');
    var Utils = require('utils');
    var d3 = require('d3');
    var $ = require('jquery');
    var uiStrings = {
        DUAL_STACK: '<br>- <b>IPv4</b>: IPv4 only (DNS A record)' +
            '<br>- <b>IPv6</b>: IPv6 only (DNS AAAA record)' +
            '<br>- <b>Dual Stack</b>: Both IPv4 and IPv6' +
            '<br>- <b>No IP</b>: No IP address given (no valid A or AAAA DNS records)'
    };

	var MainView = Backbone.View.extend({
		el: "#content-outer",

		initialize: function(_router){
			this.router = _router;

			this.$content = $("#content", this.$el);

			this.model = new ViewModel();
			this.controllerModel = new ControllerModel();
			
			this.viewList = [];
			
			this.menuView = new MenuView({model: this.model});
			this.sideView = new SideView({model: this.model});
			this.controllerView = new ControllerView({model: this.model, controllerModel: this.controllerModel});
			this.mapView = new MapView({model: this.model});

			this.listenTo(this.router, "route", this.route);
		},

		render: function() {
			$(this.$el).tooltip({
				position: {
					my: "center top+10",
					at: "center bottom",
					collision: "flipfit"
				},
				tooltipClass: "help-tooltip",
				content: function() {
					return $(this).attr('title');
				},
				track: true,
				show: {
					duration: 200
				},
				hide: {
					duration: 100
				}
			});

			//this.controllerView.resize();
		},

		setViews: function(_viewList) {
            var newViews = _.difference(_viewList, this.viewList) || [];
            this.removeViews(_.difference(this.viewList, _viewList));
            for(var i = 0; i < newViews.length; i++){
				var view = newViews[i];
				this.addView(view);
			}
			this.render();
		},

        addView: function(_view){
            this.viewList.push(_view);
            this.$content.append(_view.$el);
            _view.render();
        },

        removeViews: function(_viewList) {
            for(var i = 0; i < _viewList.length; i++){
                _viewList[i].remove();
                _viewList[i].$el.remove();
            }
            this.viewList = _.difference(this.viewList, _viewList) || [];
        },

		route: function(_route, args) {
			this.controllerModel.set(this.controllerModel.defaults);
			this.model.set({
				'routeLabel': _route,
				'pageBase': "/" + window.location.pathname.split("/", 2)[1],
				'detailTitle': null,
				'apiBase': null,
				'title': null
			});

			this.menuView.render();
			this["route_" + _route](args);
		},

		route_home: function(){
			dbg("home");

            var processData = function(_data) {
                var date, c;
                for (date in _data) {
                    c = _data[date];
                    for(var i in c){
                        c[i].percentage = c[i].hosts ? c[i].hosts6 / c[i].hosts : 0;
                    }
                }
            };

            this.setViews([
                this.mapView,
                this.controllerView
            ]);

            this.model.mapModel.set({
				'mode': 'sphere',
				'legend': 'IPv6 enabled Hosts',
				'processData':processData
			});
            this.model.detailModel.set(this.model.detailModel.defaults);
            this.model.set({
				'detailTitle' : null,
				'apiBase' : '/hosts',
				'country': null,
				'queryTLD': null,
				'queryTypes': null,
				'querySample': 50
			});
			this.controllerModel.set({
				'animate': true,
				'groups': false,
				'settings': false
			});

		},

		route_hosts: function(_args){
			dbg("v6hosts");

            var genColumns = function(_group) {
                var cols = [{'name':'group', 'header': Utils.formatGroupTitle(_group), format:Utils.noFormat,'summary':{}, 'aggFunc': Utils.aggSize},
                        {'name':'hosts', 'header':'Hosts', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Total number of Hosts'},
                        {'name':'hosts6', 'header':'IPv6 Enabled Hosts', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Total number of IPv6 enabled Hosts<br>(This includes IPv6 only and Dual Stack Hosts)<br><b>= any host with a AAAA DNS record</b>'},
                        {'name':'percentage', 'header':'IPv6 Host (%)', format:d3.format('.2%'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:'Percentage of Hosts that have an IPv6 address<br><b>= IPv6 Hosts / Hosts</b>'}];

                if(_group === 'country') cols[0].format = Utils.formatCountry;

                return cols;
            };

            var processData = function(_data) {
                var date, c;
                for (date in _data) {
                    c = _data[date];
                    for(var i in c){
                        c[i].percentage = c[i].hosts ? c[i].hosts6 / c[i].hosts : 0;
                    }
                }
            };

            this.model.mapModel.set({
				'mode': 'flat',
				'legend': 'IPv6 enabled Hosts',
				'processData':processData
			});
            this.model.detailModel.set({'groups': ['country', 'tld', 'type'], 'group':'country', 'processData':processData, 'genColumns':genColumns});
			this.model.set(_.object(['country'], _args));
			this.model.set({
				'detailTitle': 'country',
				'apiBase' : '/hosts'
			});

			this.setViews([
				this.mapView,
				this.controllerView,
				new PanelView({'views':[new PenetrationGraphView({model: this.model})],
                    'title': 'IPv6 Host percentage by <%= group %> over time', 'desc': 'This graph shows the percentage of IPv6 enabled Hosts for the selected group type over time. This includes IPv6 only and Dual Stack Hosts - any host with a AAAA DNS record.', model: this.model}),
                new PanelView({'views':[new TableView({model: this.model})],
                    'title': 'IPv6 Host percentage by <%= group %> for <%= date %>', 'desc': 'This table shows a breakdown of the IPv6 Host percentage for the selected date and group type.', model: this.model})
			]);
		},

		route_dualstack: function(_args){
			dbg("dualstack");

            var genColumns = function(_group) {
                var cols = [{'name':'group', 'header':Utils.formatGroupTitle(_group), format:Utils.noFormat,'summary':{}, 'aggFunc': Utils.aggSize},
                    {'name':'hosts', 'header':'Hosts', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Total number of Hosts'},
                    {'name':'hosts4', 'header':'IPv4', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Total number of IPv4 only Hosts'},
                    {'name':'hosts6', 'header':'IPv6', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Total number of IPv6 only Hosts'},
                    {'name':'dualstack', 'header':'Dual Stack', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Total number of Dual Stack Hosts (IPv4 and IPv6)'},
                    {'name':'noip', 'header':'No IP', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Total number of Hosts with no A or AAAA DNS record'}];
				if(_group === 'country') cols[0].format = Utils.formatCountry;
                return cols;
            };

            var processData = function(_data) {
                var date, c;
                for (date in _data) {
                    c = _data[date];
                    for(var i in c){
                        c[i].percentage = c[i].hosts ? c[i].dualstack / c[i].hosts : 0;
                    }
                }
            };

            this.model.mapModel.set({
				'mode': 'flat',
				'legend': 'Dual Stack Hosts',
				'processData':processData
			});
            this.model.detailModel.set({'groups': ['country', 'tld', 'type'], 'group':'country', 'processData':processData, 'genColumns':genColumns, 'dualstackData': 'dualstack'});

            this.model.set(_.object(['country'], _args));
            this.model.set({
				'detailTitle': 'country',
				'apiBase' : '/dualstack'
			});

			this.setViews([
				this.mapView,
				this.controllerView,
                new PanelView({'views':[new FixedSeriesGraphView({model: this.model})],
                    'title': 'Distribution of Host types over time', desc: 'This graph shows the distribution of all types of IP implementation over time.<br>'+uiStrings.DUAL_STACK, model: this.model}),
                new PanelView({'views':[new DualstackGraphView({model: this.model})],
                    'title': '<%= column %> Hosts by <%= group %> over time', 'desc': 'This graph shows the distribution breakdown for the selected IP implementation and group type over time.<br>'+uiStrings.DUAL_STACK, model: this.model}),
                new PanelView({'views':[new TableView({model: this.model})],
                    'title': 'Distribution of Host types by <%= group %> for <%= date %>', 'desc': 'This table shows a breakdown of the totals for each IP implementation type (IPv4 Only / IPv6 Only / Dual Stack / No IP) for the given date and group type.', model: this.model})
			]);
		},

		route_ping: function(_args){
			dbg("ping");

            var genColumns = function(_group) {
                var cols = [{'name':'group', 'header':Utils.formatGroupTitle(_group), format:Utils.noFormat,'summary':{}, 'aggFunc': Utils.aggSize},
                    {'name':'hosts', 'header':'Hosts', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc: "Total number of successfully tested Dual Stack Hosts"},
                    {'name':'faster', 'header':'Lower IPv6 Ping', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Number of Hosts with a Lower IPv6 Ping than IPv4 Ping"},
                    {'name':'percentage', 'header':'Lower IPv6 Ping (%)', format:d3.format('.2%'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:"Percentage of Hosts with a Lower IPv6 Ping than IPv4 Ping<br><b>= Lower IPv6 Ping / Hosts"},
                    {'name':'ping4', 'header':'IPv4 Ping (ms)', format:d3.format('.2f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total sum of IPv4 Ping in Milliseconds (ms)"},
                    {'name':'ping6', 'header':'IPv6 Ping (ms)', format:d3.format('.2f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total sum of IPv6 Ping in Milliseconds (ms)"},
                    {'name':'ratio', 'header':'Ping Ratio', format:d3.format('.3f'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:"Average difference ratio between IPv4 and IPv6 Pings<br><b>= IPv6 Ping / IPv4 Ping"}];
                if(_group === 'country') cols[0].format = Utils.formatCountry;
                return cols;
            };

            var processData = function(_data) {
                var date, c;
                for (date in _data) {
                    c = _data[date];
                    for(var i in c){
                        c[i].percentage = c[i].hosts ? c[i].faster / c[i].hosts : 0;
                        c[i].ratio = c[i].ping4 ? c[i].ping6 / c[i].ping4 : 0;
                    }
                }
            };

            this.model.mapModel.set({
				'mode': 'flat',
				'legend': 'Lower IPv6 Pings',
				'processData':processData
			});
            this.model.detailModel.set({'groups': ['country', 'tld', 'type'], 'group':'country', 'processData':processData, 'genColumns':genColumns});

			this.model.set(_.object(['country'], _args));
			this.model.set({
				'detailTitle': 'country',
				'apiBase' : '/ping'
			});

			this.setViews([
				this.mapView,
                this.controllerView,
                new PanelView({'views':[new PSummaryGraphView({model: this.model, page: 'ping'})],
                    'title': 'Lower Ping on IPv6 and Ping Ratio over time', 'desc': 'This graph compares ping times to dual stack hosts over the IPv4 or IPv6 internet.<br><br>- <b>Lower Ping on IPv6</b>: displays the percentage of Dual Stack Hosts that have a lower ping over IPv6 than over IPv4.<br><br>- <b>Ping Ratio</b>: displays the ratio between Dual Stack Host Pings (= IPv6 Ping / IPv4 Ping).', model: this.model}),
                new PanelView({'views':[new PGraphView({model: this.model, page:'ping'})],
                    'title': '<%= column %> by <%= group %> over time', 'desc': 'This graph shows a detailed comparison between IPv6 and IPv4 Pings broken down by the <b>selected grouping</b> over time.<br><br>- <b>Lower Ping on IPv6</b>: displays the percentage of Dual Stack Hosts that have a lower ping over IPv6 than over IPv4.<br><br>- <b>Ping Ratio</b>: displays the ratio between Dual Stack Host Pings (= IPv6 Ping / IPv4 Ping).', model: this.model}),
                new PanelView({'views':[new TableView({model: this.model})],
                    'title': 'IPv4 and IPv6 Host Pings by <%= group %> for <%= date %>', 'desc': 'This table shows a breakdown of Dual Stack Host Pings and Ping Ratios for the selected date and group type.', model: this.model})
			]);
		},

		route_path: function(_args){
			dbg("path");

            var genColumns = function(_group) {
                var cols = [{'name':'group', 'header':Utils.formatGroupTitle(_group), format:Utils.noFormat,'summary':{}, 'aggFunc': Utils.aggSize},
                    {'name':'hosts', 'header':'Hosts', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total number of successfully tested Dual Stack Hosts"},
                    {'name':'fewer', 'header':'Fewer IPv6 Hops', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Number of Hosts with fewer Hops for IPv6 than IPv4"},
                    {'name':'percentage', 'header':'Fewer IPv6 Hops (%)', format:d3.format('.2%'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:"Percentage of Hosts with fewer Hops for IPv6 than IPv4<br><b>= Fewer IPv6 Hops / Hosts</b>"},
                    {'name':'hops4', 'header':'IPv4 Hops', format:d3.format('.2f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total sum of IPv4 Hop counts"},
                    {'name':'hops6', 'header':'IPv6 Hops', format:d3.format('.2f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total sum of IPv6 Hop counts"},
                    {'name':'ratio', 'header':'Hop Ratio', format:d3.format('.3f'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:"Ratio between IPv6 and IPv4 Hop count<br><b>= IPv6 Hops / IPv4 Hops</b>"}];
                if(_group === 'country') cols[0].format = Utils.formatCountry;
                return cols;
            };

            var processData = function(_data) {
                var date, c;
                for (date in _data) {
                    c = _data[date];
                    for(var i in c){
                        c[i].percentage = c[i].hosts ? c[i].fewer / c[i].hosts : 0;
                        c[i].ratio = c[i].hops4 ? c[i].hops6 / c[i].hops4 : 0;
                    }
                }
            };

            this.model.mapModel.set({
				'mode': 'flat',
				'legend': 'Fewer IPv6 Hops',
				'processData':processData
			});
            this.model.detailModel.set({'groups': ['country', 'tld', 'type'], 'group':'country', 'processData':processData, 'genColumns':genColumns});

			this.model.set(_.object(['country'], _args));
			this.model.set({
				'detailTitle': 'country',
				'apiBase' : '/path'
			});

			this.setViews([
				this.mapView,
                this.controllerView,
                new PanelView({'views':[new PSummaryGraphView({model: this.model, page: 'path'})],
                    'title': 'Fewer IPv6 Hops and Path Ratio over time', 'desc': 'This graph shows the percentage of dual stack hosts that have a shorter traceroute length over IPv6 than IPv4 and the ratio between the IPv6 and IPv4 traceroute length.<br><br>- <b>Fewer IPv6 Hops</b>: displays the percentage of dual stack hosts that have a shorter traceroute length over IPv6 than over IPv4.<br><br>- <b>Hop Ratio</b>: displays the ratio between IPv6 and IPv4 traceroute length on dual stack hosts (= IPv6 Hops / IPv4 Hops).', model: this.model}),
                new PanelView({'views':[new PGraphView({model: this.model, page:'path'})],
                    'title': '<%= column %> by <%= group %> over time', 'desc': 'This graph shows detailed IPv6 and IPv4 dual stack host path length and hop ratios broken down by the selected group over time.<br><br>- <b>Fewer IPv6 Hops</b>: displays the percentage of dual stack hosts that have a shorter traceroute length over IPv6 than over IPv4.<br><br>- <b>Hop Ratio</b>: displays the ratio between IPv6 and IPv4 traceroute length on dual stack hosts (= IPv6 Hops / IPv4 Hops).', model: this.model}),
                new PanelView({'views':[new TableView({model: this.model})],
                    'title': 'IPv4 and IPv6 Path length by <%= group %> for <%= date %>', 'desc': 'This table shows a breakdown of IPv6/IPv4 traceroute lengths by the current group type for the selected date.', model: this.model})
			]);
		},

		route_reach: function(_args){
			dbg("reach");

            var genColumns = function(_group) {
                var cols = [{'name':'group', 'header':Utils.formatGroupTitle(_group), format:Utils.noFormat,'summary':{}, 'aggFunc': Utils.aggSize},
                    {'name':'hosts4', 'header':'IPv4 Hosts', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total number of tested Hosts"},
                    {'name':'reach4', 'header':'Reachable IPv4', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total number of hosts that successfully responded over IPv4 on the tested protocols"},
                    {'name':'percentage4', 'header':'Reachable IPv4 (%)', format:d3.format('.2%'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:"Total percentage of Hosts reachable over IPv4<br><b>= Reachable IPv4 / IPv4 Hosts</b>"},
                    {'name':'hosts6', 'header':'IPv6 Hosts', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total number of IPv6 Hosts"},
                    {'name':'reach6', 'header':'Reachable IPv6', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total number of hosts that successfully responded over IPv6 on the tested protocols"},
                    {'name':'percentage', 'header':'Reachable IPv6 (%)', format:d3.format('.2%'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:"Total percentage of Hosts reachable over IPv6<br><b>= Reachable IPv6 / IPv6 Hosts</b>"}];
                if(_group === 'country') cols[0].format = Utils.formatCountry;
                return cols;
            };

            var processData = function(_data) {
                var date, c;
                for (date in _data) {
                    c = _data[date];
                    for(var i in c){
                        c[i].percentage = c[i].hosts6 ? c[i].reach6 / c[i].hosts6 : 0;
                        c[i].percentage4 = c[i].hosts4 ? c[i].reach4 / c[i].hosts4 : 0;
                    }
                }
            };

            this.model.mapModel.set({
				'mode': 'flat',
				'legend': 'IPv6 Host Reachability',
				'processData':processData
			});
            this.model.detailModel.set({'groups': ['country', 'tld', 'service'], 'group':'service', 'processData':processData, 'genColumns':genColumns});

			this.model.set(_.object(['country'], _args));
			this.model.set({
				'detailTitle': 'country',
				'apiBase' : '/reach'
			});

			this.setViews([
				this.mapView,
                this.controllerView,
                new PanelView({'views':[new ReachSummaryGraphView({model: this.model})],
                    'title': 'IPv6 and IPv4 Host Reachability over time', 'desc': 'This graph shows the percentage of IPv6 and IPv4 hosts that successfully responded on the tested protocols. Note that this is combined reachability on all protocols, and many smaller hosts intentionally do not implement HTTPS access - artificially lowering IPv4 reachability.', model: this.model}),
                new PanelView({'views':[new ReachGraphView({model: this.model})],
                    'title': '<%= column %> percentage by <%= group %> over time', 'desc': 'This graph shows the percentage of hosts that are reachable over the selected IP version broken down by the selected group over time', model: this.model}),
                new PanelView({'views':[new TableView({model: this.model})],
                    'title': 'IPv4 and IPv6 Host Reachability by <%= group %> for <%= date %>', 'desc': 'This table shows a comparison between IPv4 and IPv6 Host Reachability for the selected group type and date.', model: this.model})
			]);
		},

		route_domains: function(_args){
			dbg("v6domains");

			var genColumns = function(_group) {
				var cols = [{'name':'group', 'header': Utils.formatGroupTitle(_group), format:Utils.noFormat,'summary':{}, 'aggFunc': Utils.aggSize},
					{'name':'domains', 'header':'Domains', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Total number of Domains'},
					{'name':'domains6', 'header':'IPv6 Domains', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Number of Domains with at least one IPv6 enabled Host'},
					//{'name':'percentage', 'header':'IPv6 Domains %', format:d3.format('.2%'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:'Percentage of domains with at least one IPv6 enabled host'},
					{'name':'www', 'header':'IPv6 WWW', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Number of Domains with at least one IPv6 enabled WWW (Web service) Host'},
					{'name':'ns', 'header':'IPv6 NS', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Number of Domains with at least one IPv6 enabled NS (Name service) Host'},
					{'name':'mx', 'header':'IPv6 MX', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Number of Domains with at least one IPv6 enabled MX (Mail service) Host'},
					{'name':'ntp', 'header':'IPv6 NTP', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:'Number of Domains with at least one IPv6 enabled NTP (Time service) Host'}];

				if(_group === 'country') cols[0].format = Utils.formatCountry;
				return cols;
			};

			var processData = function(_data) {
				var date, c;
				for (date in _data) {
					c = _data[date];
					for(var i in c){
						c[i].percentage = c[i].domains ? c[i].domains6 / c[i].domains : 0;
					}
				}
			};

			this.model.mapModel.set({
				'mode': 'flat',
				'legend': 'IPv6 enabled Domains',
				'processData':processData
			});
			this.model.detailModel.set({'groups': ['country', 'tld'], 'group':'country', 'processData':processData, 'genColumns':genColumns});
			this.model.set(_.object(['country'], _args));
			this.model.set({
				'detailTitle': 'country',
				'apiBase' : '/domains'
			});

			this.setViews([
				this.mapView,
				this.controllerView,
				new PanelView({'views':[new DomainsGraphView({model: this.model, page: 'domains'})],
					'title': 'IPv6 enabled Domains by <%= group %> over time', 'desc': 'This graph shows the percentage of Domains with <b>at least one IPv6 enabled host</b> (has a DNS AAAA record) over time. <br><br>- <b>Any</b>: at least one IPv6 host on this domain<br>- <b>WWW</b>: at least one IPv6 WWW (Web) Host<br>- <b>MX</b>: at least one IPv6 MX (Email) Host<br>- <b>NTP</b>: at least one IPv6 NTP (Time server) Host<br>- <b>NS</b>: at least one IPv6 NS (Nameserver) Host', model: this.model}),
				new PanelView({'views':[new TableView({model: this.model})],
					'title': 'IPv6 enabled domains by <%= group %> for <%= date %>', 'desc': 'This table shows a detailed breakdown of how many domain names have at least one IPv6 enabled host for the given date and data grouping', model: this.model})
			]);
		},

		route_search: function (_args){
			dbg("domain search");

			var genColumns = function(_group) {
				return [];
			};

			var processData = function(_data) {
				var date, d;
				for (date in _data) {
					d = _data[date][_.keys(_data[date])[0]];
                    d.www_p = d.www_hosts ? d.www_hosts6 / d.www_hosts : 0;
                    d.mx_p = d.mx_hosts ? d.mx_hosts6 / d.mx_hosts : 0;
                    d.ns_p = d.ns_hosts ? d.ns_hosts6 / d.ns_hosts : 0;
                    d.ntp_p = d.ntp_hosts ? d.ntp_hosts6 / d.ntp_hosts : 0;
                    d.www_hosts4 = d.www_hosts - d.www_hosts6;
                    d.mx_hosts4 = d.mx_hosts - d.mx_hosts6;
                    d.ns_hosts4 = d.ns_hosts - d.ns_hosts6;
                    d.ntp_hosts4 = d.ntp_hosts - d.ntp_hosts6;
                    d.hosts4 = d.www_hosts4 + d.mx_hosts4 + d.ns_hosts4 + d.ntp_hosts4;
                    d.hosts6 = d.www_hosts6 + d.mx_hosts6 + d.ns_hosts6 + d.ntp_hosts6;
                    d.hosts = d.hosts6;
                    d.ping4 = 1;
                    d.ping6 = d.pingratio;
                    d.hops4 = 1;
                    d.hops6 = d.hopratio;
                    d.HTTP = {'hosts6':d.www_hosts6,'reach6':d.http6,'hosts4':d.www_hosts,'reach4':d.http4};
                    d.HTTPS = {'hosts6':d.www_hosts6,'reach6':d.https6,'hosts4':d.www_hosts,'reach4':d.https4};
                    d.SMTPS = {'hosts6':d.hosts6,'reach6':d.smtp6,'hosts4':d.hosts4,'reach4':d.smtp4};
				}
			};

			this.model.set(_.object(['domain'], _args));
			this.model.set({
				'detailTitle': this.model.get('domain') ? 'domain' : null,
				'apiBase' : '',
                'pageBase' : '/domain'
			});
			this.model.mapModel.set({
				'loadUrl': this.model.get('domain') ? '/domain-' + this.model.get('domain') : '',
				'processData': processData
			});
			this.model.detailModel.set({
				'loadUrl': this.model.get('domain') ? '/domain-' + this.model.get('domain') : '',
				'processData': processData,
				'genColumns': genColumns,
				'group': 'domain' //hack, shouldn't need to do this
			});
			this.controllerModel.set({
				'animate': false,
				'groups': false,
				'settings': true
			});

			var views = [new SearchView({model: this.model})];
			if(this.model.get('domain')){
                var hostCols = [{'name':'group', 'header': 'Service Type', format:Utils.noFormat},
                    {'suffix':'_hosts', 'header':'Hosts', format:d3.format('f')},
                    {'suffix':'_hosts6', 'header':'IPv6 Hosts', format:d3.format('f')},
                    {'suffix':'_p', 'header':'% IPv6', format:d3.format('.2%')}];

                var reachCols = [{'name':'group', 'header': 'Protocol', format:Utils.noFormat},
                    {'suffix':'hosts4', 'header':'IPv4 Hosts Tested', format:d3.format('f')},
                    {'suffix':'reach4', 'header':'IPv4 Hosts Reached', format:d3.format('f')},
                    {'suffix':'hosts6', 'header':'IPv6 Hosts Tested', format:d3.format('f')},
                    {'suffix':'reach6', 'header':'IPv6 Hosts Reached', format:d3.format('f')}];

				views = views.concat([
                    new PanelView({
                        'views':[
                            new FixedSeriesGraphView({model: this.model, series: {'www_hosts4': 'IPv4 WWW','mx_hosts4': 'IPv4 MX','ns_hosts4': 'IPv4 NS','ntp_hosts4': 'IPv4 NTP','www_hosts6': 'IPv6 WWW','mx_hosts6': 'IPv6 MX','ns_hosts6': 'IPv6 NS','ntp_hosts6': 'IPv6 NTP'}}),
                            new CustomTableView({model: this.model, columns:hostCols, rows:['www','mx','ns','ntp']})],
                        'title': 'IPv6 Host percentage over time',
                        'desc': 'This graph shows the percentage of hosts on this domain with IPv6 enabled over time.<br><br>- <b>IPv4 Hosts</b>: Hosts with no IPv6 address (IPv4 only)<br>- <b>IPv6 Hosts</b>: - Hosts with an IPv6 address (AAAA DNS record)', model: this.model}),
                    new PanelView({'views':[new PSummaryGraphView({model: this.model, page: 'ping'})],
                        'title': 'Lower Ping on IPv6 and Ping Ratio over time', 'desc': 'This graph compares ping times to dual stack hosts over the IPv4 or IPv6 internet.<br><br>- <b>Lower Ping on IPv6</b>: displays the percentage of Dual Stack Hosts that have a lower ping over IPv6 than over IPv4.<br><br>- <b>Ping Ratio</b>: displays the ratio between Dual Stack Host Pings (= IPv6 Ping / IPv4 Ping).', model: this.model}),
                    new PanelView({'views':[new PSummaryGraphView({model: this.model, page: 'path'})],
                        'title': 'Fewer IPv6 Hops and Path Ratio over time', 'desc': 'This graph shows the percentage of dual stack hosts that have a shorter traceroute length over IPv6 than IPv4 and the ratio between the IPv6 and IPv4 traceroute length.<br><br>- <b>Fewer IPv6 Hops</b>: displays the percentage of dual stack hosts that have a shorter traceroute length over IPv6 than over IPv4.<br><br>- <b>Hop Ratio</b>: displays the ratio between IPv6 and IPv4 traceroute length on dual stack hosts (= IPv6 Hops / IPv4 Hops).', model: this.model}),
                    new PanelView({'views':[new DomainReachGraphView({model: this.model}),
                        new CustomTableView({model: this.model, columns:reachCols, rows:['HTTP','HTTPS','SMTPS'], nested: true})],
                        'title': '<%= column %> percentage over time', 'desc': 'This graph shows the percentage of Hosts that are reachable over the selected IP version by service type over time', model: this.model}),
                    this.controllerView
				]);
			}

			this.setViews(views);
		},

		route_country: function (_args) {
			dbg("country");

			var processDataMap = function(_data) {
				var date, c;
				for (date in _data) {
					c = _data[date];
					for(var i in c){
						c[i].percentage = c[i].hosts ? c[i].hosts6 / c[i].hosts : 0;
					}
				}
			};

			var processDataDetail = function(_data) {
				var date, c;
				for (date in _data) {
					c = _data[date];
					for(var i in c){
						c[i].percentage = c[i].hosts ? c[i].hosts6 / c[i].hosts : 0;
						c[i].pingpercentage = c[i].pinghosts ? c[i].faster / c[i].pinghosts : 0;
						c[i].pingratio = c[i].ping4 ? c[i].ping6 / c[i].ping4 : 0;
						c[i].pathpercentage = c[i].hosts ? c[i].fewer / c[i].hosts : 0;
						c[i].pathratio = c[i].hops4 ? c[i].hops6 / c[i].hops4 : 0;
					}
				}
			};

			var genColumns = function(_group) {
				var cols = [
					{'name':'group', 'header': Utils.formatGroupTitle(_group), format:Utils.formatCountry,'summary':{}},
					//{'name':'hosts', 'header':'Hosts', format:d3.format('f'), 'summary':{}, desc:'Total number of Hosts'},
					//{'name':'hosts6', 'header':'IPv6 Hosts', format:d3.format('f'), 'summary':{}, desc:'Total number of IPv6 enabled Hosts<br>(including IPv6 only and Dual Stack Hosts)'},
					{'name':'percentage', 'header':'IPv6 Host (%)', format:d3.format('.2%'), 'summary':{}, desc:'Percentage of Hosts that are IPv6 enabled<br><b>= IPv6 Hosts / Hosts</b>'},
					//{'name':'pinghosts', 'header':'Hosts', format:d3.format('f'), 'summary':{}, desc: "Total number of successfully tested Dual Stack Hosts"},
					//{'name':'faster', 'header':'Lower IPv6 Ping', format:d3.format('f'), 'summary':{}, desc:"Number of Hosts with a Lower IPv6 Ping than IPv4 Ping"},
					{'name':'pingpercentage', 'header':'Lower IPv6 Ping (%)', format:d3.format('.2%'), 'summary':{}, desc:"Percentage of Hosts with a Lower IPv6 Ping than IPv4 Ping<br><b>= Lower IPv6 Ping / Hosts"},
					//{'name':'ping4', 'header':'IPv4 Ping (ms)', format:d3.format('.2f'), 'summary':{}, desc:"Total IPv4 Ping in Milliseconds (ms)"},
					//{'name':'ping6', 'header':'IPv6 Ping (ms)', format:d3.format('.2f'), 'summary':{}, desc:"Total IPv6 Ping in Milliseconds (ms)"},
					{'name':'pingratio', 'header':'Ping Ratio', format:d3.format('.3f'), 'summary':{}, desc:"Average difference ratio between IPv4 and IPv6 Pings<br><b>= IPv6 Ping / IPv4 Ping"},
					//{'name':'hosts', 'header':'Hosts', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total number of successfully tested Dual Stack Hosts"},
					//{'name':'fewer', 'header':'Fewer IPv6 Hops', format:d3.format('f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Number of Hosts with fewer Hops for IPv6 than IPv4"},
					{'name':'pathpercentage', 'header':'Fewer IPv6 Hops (%)', format:d3.format('.2%'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:"Percentage of Hosts with fewer Hops for IPv6 than IPv4<br><b>= Fewer IPv6 Hops / Hosts</b>"},
					//{'name':'hops4', 'header':'IPv4 Hops', format:d3.format('.2f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total IPv4 Hop count"},
					//{'name':'hops6', 'header':'IPv6 Hops', format:d3.format('.2f'), 'summary':{}, 'aggFunc': [Utils.aggTotal, Utils.aggAvg], desc:"Total IPv6 Hop count"},
					{'name':'pathratio', 'header':'Hop Ratio', format:d3.format('.3f'), 'summary':{}, 'aggFunc': Utils.aggAvg, desc:"Average difference ratio between IPv6 and IPv4 Hop count<br><b>= IPv6 Hops / IPv4 Hops</b>"}
					];

				return cols;
			};

			this.model.mapModel.set({
				'mode': 'flat',
				'legend': 'IPv6 enabled Hosts',
				'processData': processDataMap
			});
			this.model.detailModel.set({
				'groups': ['country'],
				'group':"country",
				'processData': processDataDetail,
				'genColumns': genColumns
			});
			this.model.set(_.object(['country'], _args));
			this.model.set({
				'title' : 'country',
				'detailTitle': null,
				'apiBase' : "",
				'pageBase' : ""
			});
			this.model.mapModel.set('loadUrl', '/hosts/group-country');
			this.model.detailModel.set('loadUrl', '/country-' + this.model.get('country'));
			this.controllerModel.set({
				'animate': false,
				'groups': false,
				'settings': true
			});

			this.setViews([
				this.mapView,
				this.controllerView,
				new PanelView({'views':[new PenetrationGraphView({model: this.model})],
					'title': 'IPv6 Host percentage over time', 'desc': 'This graph shows the percentage of IPv6 enabled Hosts for the selected group type over time. This includes IPv6 only and Dual Stack Hosts.', model: this.model}),
				new PanelView({'views':[new PSummaryGraphView({model: this.model, page: 'ping'})],
					'title': 'Lower IPv6 Pings and Ping Ratio over time', 'desc': 'This graph shows the percentage of Dual Stack Hosts that have a Lower IPv6 Ping and the ratio between IPv6 Pings and IPv4 Pings.<br><br>- <b>Lower IPv6 Ping</b>: displays the percentage of Dual Stack Hosts that have a lower IPv6 Ping than their IPv4 counterparts.<br><br>- <b>Ping Ratio</b>: displays the difference ratio between Dual Stack Host Pings (= IPv6 Ping / IPv4 Ping)', model: this.model}),
				new PanelView({'views':[new PSummaryGraphView({model: this.model, page: 'path'})],
					'title': 'Fewer IPv6 Hops and Path Ratio over time', 'desc': 'This graph shows the percentage of Dual Stack Hosts that have Fewer IPv6 Hops and the ratio between IPv6 and IPv4 Hop counts over time.<br><br>- <b>Fewer IPv6 Hops</b>: displays the percentage of Dual Stack Hosts that have a shorter IPv6 Traceroute length than their IPv4 counterparts.<br><br>- <b>Hop Ratio</b>: displays the difference ratio between Dual Stack Hop counts (= IPv6 Path / IPv4 Path).', model: this.model}),
				new PanelView({'views':[new TableView({model: this.model})],
					'title': 'Data overview for <%= country %>, <%= date %>', 'desc': 'This table shows a detailed breakdown of how many domain names have at least one IPv6 enabled host for the given date and data grouping', model: this.model})
			]);
		}
	});

	return MainView;
});