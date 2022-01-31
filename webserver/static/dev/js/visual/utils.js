define(function (require) {
    var d3 = require('d3');
    var isoToCodeDictionary = JSON.parse(require('text!static/country-isotocode.json'));
    var codeToNameDictionary = JSON.parse(require('text!static/country-codetoname.json'));

	var _ = require('underscore');
	_.str = require('underscore.string');

    var Utils = {
		/* country codes/names/iso conversion */
        isoToCode: function (_iso) {
            return isoToCodeDictionary[_iso];
        },

        codeToIso: function (_code) {
            for(var iso in isoToCodeDictionary){
                if(isoToCodeDictionary[iso] === _code){
                    return iso;
                }
            }
            return null;
        },
        codeToName: function(_code) {
            return codeToNameDictionary[_code] || _code;
        },

		/* format types */
        noFormat: function (a) {
            return a;
        },
		formatCountry: function(c) {
			return '<a href="/country-' + c + '">' + Utils.codeToName(c) + '</a>';
		},
		formatDomain: function(d) {
			return '<a href="/search/domain-' + d + '">' + d + '</a>';
		},
		formatGroupTitle: function(g) {
			switch(g){
				case 'tld':
					return 'TLD';
				case 'type':
					return 'Service Type';
				case 'service':
					return 'Protocol';
				default:
					return _.str.capitalize(g);
			}
		},
		formatDate: function(d){
			return d ? d3.time.format('%B %Y')(new Date(d)) : '';
		},

		/* aggregate functions */
		aggSize: function(d) {
			return '<span>Total</span><br>' + _.size(d);
		},
        aggTotal: function(d, col) {
            return '<span>Total</span><br>' + col.format(d3.sum(d,function(c) { return +c[col.name]; }));
        },
        aggAvg: function(d, col) {
            return '<span>Average</span><br>' + col.format(d3.mean(d,function(c) { return +c[col.name]; }));
        },

		/* standard descriptions */
		descGroup: function(g) {
			var desc = "Group graph and table data by ";
			switch(g){
				case 'tld':
					desc += '<b>TLD (Top Level Domain)</b><br><br>- e.g. .com, .org, .fr etc';
					break;
				case 'type':
					desc += '<b>Service Type</b><br><br>- <b>WWW</b>: Web service<br>- <b>MX</b>: Mail service<br>- <b>NTP</b>: Time service<br>- <b>NS</b>: Name service';
					break;
				case 'country':
					desc += '<b>Country</b>';
					break;
				case 'service':
					desc += '<b>Protocol</b><br><br>- <b>HTTP</b>: Hypertext Transfer Protocol<br>- <b>HTTPS</b>: Secure Hypertext Transfer Protocol<br>- <b>SMTPS</b>: Secure Simple Mail Transfer Protocol<br>';
			}

			return desc;
		},

		/* CONSTANTS */
		RESIZE_DELAY: 250
    };

    return Utils;
});