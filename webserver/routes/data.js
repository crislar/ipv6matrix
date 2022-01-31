/*
 * Data API
 */

//require
var mysql = require('mysql'),
	db = require('../dbschema'),
	_ = require('lodash'),
	sqlEscape = require('sql-escape');

var data = {};

//route map
module.exports = function(app){
	app.map({
		'/:format(data|json|xml|html|csv)': {
			'/hosts': {
				'/group-:group(tld|country|type)': {
					'/country-:country': {
						get: data.v6hosts
					},
					'/?': {
						get: data.v6hosts
					}
				},
				'/?': {
					get: data.v6hosts
				}
			},
			'/domains': {
				'/group-:group(tld|country|type)': {
					'/country-:country': {
						get: data.v6domains
					},
					'/?': {
						get: data.v6domains
					}
				},
				'/?': {
					get: data.v6domains
				}
			},
			'/reach': {
				'/group-:group(tld|country|service)': {
					'/country-:country': {
						get: data.reach
					},
					'/?': {
						get: data.reach
					}
				},
				'/?': {
					get: data.reach
				}
			},
			'/dualstack': {
				'/group-:group(tld|country|type)': {
					'/country-:country': {
						get: data.dualstack
					},
					'/?': {
						get: data.dualstack
					}
				},
				'/?': {
					get: data.dualstack
				}
			},
			'/ping': {
				'/group-:group(tld|country|type)': {
					'/country-:country': {
						get: data.ping
					},
					'/?': {
						get: data.ping
					}
				},
				'/?': {
					get: data.ping
				}
			},
			'/path': {
				'/group-:group(tld|country|type)': {
					'/country-:country': {
						get: data.path
					},
					'/?': {
						get: data.path
					}
				},
				'/?': {
					get: data.path
				}
			},
			'/domain': {
				'/search-:search': {
					'/?': {
						get: data.search
					}
				}
			},
			'/domain-:domain': {
				'/?': {
					get: data.domain
				}
			},
			'/country-:country': {
				'/?': {
					get: data.country
				}
			},
			'*': {
				get: data.error
			}
		}
	});
};

//data queries
data.filterQuery = function(query, t, req, minSampleCol) {
	if(req.params.country) query.where(t.country.equals(sqlEscape(req.params.country)));

	if(req.query.types) query.where(t.type.in(req.query.types.split(",")));

	if(req.query.tlds) query.where(t.tld.in(req.query.tlds.split(",")));

	if(req.params.group) {
		//console.log('req.params.group', req.params.group);
		//console.log('sqlEscape(req.params.group)', sqlEscape(req.params.group));
		query.select(t[sqlEscape(req.params.group)]).group(t.date, t[sqlEscape(req.params.group)]);
	} else {
		query.group(t.date);
	}

	//This is a bit hacky, but the sql builder library has no way to reference an aggregate column
	//if(req.query['min-sample']) query.having(t.hosts.gt(req.query['min-sample']));
	if(req.query['min-sample'] && minSampleCol) query.having(minSampleCol+' >= '+Number(req.query['min-sample']));

	return query;
};

data.v6hosts = function(req, res){
	var t = db.hostData;
	//manual hosts6 query as sql builder does not support
	var query = t.select(t.date,t.hosts.sum().as('hosts'), 'SUM(hosts6) + SUM(dualstack) as hosts6');
	query = data.filterQuery(query, t, req, 'hosts').toQuery();
	data.renderQuery(req, res, query.text, query.values, ["date"]);
};

data.v6domains = function(req, res){
	var t = db.domainPen;
	var query = t.select(t.date,t.domains.sum().as('domains'), t.domains6.sum().as('domains6'),t.www.sum().as('www'),t.ns.sum().as('ns'),t.mx.sum().as('mx'),t.ntp.sum().as('ntp'));
	query = data.filterQuery(query, t, req, 'domains').toQuery();
	data.renderQuery(req, res, query.text, query.values, ["date"]);
};

data.reach = function(req, res){
	var t = db.reach;
	var query = t.select(t.date,t.hosts4.sum().as('hosts4'), t.hosts6.sum().as('hosts6'), t.reach4.sum().as('reach4'), t.reach6.sum().as('reach6'));
	query = data.filterQuery(query, t, req, 'hosts4').toQuery();
	data.renderQuery(req, res, query.text, query.values, ["date"]);
};

data.dualstack = function(req, res){
	var t = db.hostData;
	var query = t.select(t.date,t.hosts.sum().as('hosts'), t.hosts4.sum().as('hosts4'), t.hosts6.sum().as('hosts6'), t.dualstack.sum().as('dualstack'), t.noip.sum().as('noip'));
	query = data.filterQuery(query, t, req, 'hosts').toQuery();
	data.renderQuery(req, res, query.text, query.values, ["date"]);
};

data.ping = function(req, res){
	var t = db.hostData;
	var query = t.select(t.date,t.pinghosts.sum().as('hosts'), t.faster.sum().as('faster'), t.ping4.sum().as('ping4'), t.ping6.sum().as('ping6'));
	query = data.filterQuery(query, t, req, 'hosts').toQuery();
	data.renderQuery(req, res, query.text, query.values, ["date"]);
};

data.path = function(req, res){
	var t = db.hostData;
	var query = t.select(t.date,t.pathhosts.sum().as('hosts'), t.fewer.sum().as('fewer'), t.hops4.sum().as('hops4'), t.hops6.sum().as('hops6'));
	query = data.filterQuery(query, t, req, 'hosts').toQuery();
	data.renderQuery(req, res, query.text, query.values, ["date"]);
};

data.search = function(req, res){
	var t = db.domains;
	var query = t.select(t.domain.distinct())
		.where(t.domain.like(sqlEscape(req.params.search)+"%")).limit(20)
		.toQuery();
	data.renderQuery(req, res, query.text, query.values);
};

data.domain = function(req, res){
	var t = db.domains;
	var query = t.select()
		.where(t.domain.equals(sqlEscape(req.params.domain)))
		.order(t.date)
		.toQuery();
	data.renderQuery(req, res, query.text, query.values, ["date", "domain"]);
};

data.country = function(req, res){
	var t = db.hostData;
	req.params.group = 'country';
	var query = t.select(t.date, t.country, t.hosts.sum().as('hosts'), t.hosts4.sum().as('hosts4'), 'SUM(hosts6) + SUM(dualstack) as hosts6', t.hosts6.sum().as('hosts6only'), t.dualstack.sum().as('dualstack'), t.noip.sum().as('noip'), t.pinghosts.sum().as('pinghosts'), t.faster.sum().as('faster'), t.ping4.sum().as('ping4'), t.ping6.sum().as('ping6'), t.pathhosts.sum().as('pathhosts'), t.fewer.sum().as('fewer'), t.hops4.sum().as('hops4'), t.hops6.sum().as('hops6'));
	query = data.filterQuery(query, t, req, 'hosts').toQuery();
	data.renderQuery(req, res, query.text, query.values, ["date"]);
};

data.error = function(req, res){
	res.status(400);
	data.render(
		req,
		res,
		[{
			error: 'Invalid URI',
			help: 'Check /api for help using the API'
		}]
	);
};

data.render = function(req, res, result, nest){
	if(!result || !result.length){
		res.status(400);
		result = [{
			error: 'Empty query',
			help: 'Check /api for help using the API'
		}];
	}

	var renderFormats = {
		json: function() {
			data.renderJSON(req, res, result, nest);
		},
		xml: function() {
			data.renderXML(req, res, result);
		},
		html: function() {
			data.renderHTML(req, res, result);
		},
		text: function() {
			data.renderCSV(req, res, result);
		},
		csv: function() {
			data.renderCSV(req, res, result);
		}
	};
	if(req.params.format !== "data") {
		//format specified in URI subdomain
		renderFormats[req.params.format]();
	}else{
		//format implied by header content-type
		res.format(renderFormats);
	}
};

data.renderJSON = function(req, res, result, nest) {
	if(!nest || !result || !result.length) {
		if(_.size(result[0])===1) {
			//Just return a list if the result is only one column
			res.json(_.map(result, _.keys(result[0])[0]));
			return;
		}
		res.json(result);
		return;
	}

	if(req.params.group) nest.push(req.params.group);

	//Created nested json structure
	function nestedInsert(obj, columns, c, row) {
		var key = row[ columns[c] ];
		if(c<columns.length-1){
			if(!obj[key]) obj[key] = {};
			nestedInsert(obj[key], columns, ++c, row);
		} else {
			obj[key] = _.omit(row, columns);
		}
	}
	var nested = {};
	for(var i=0; i < result.length; i++){
		nestedInsert(nested, nest, 0, result[i]);
	}
	res.json(nested);
};

data.renderXML = function(req, res, result) {
	res.render('data.xml.pug', {json: result});
};

data.renderHTML = function(req, res, result) {
	res.render('data.html.pug', {json: result});
};

data.renderCSV = function(req, res, result) {
	var columns = _.keys(result[0]);
	var out = columns.join(',')+"\n";
	for(var i=0; i < result.length; i++){
		out += _.values(result[i]).join(',') + "\n";
	}
	res.send(out);
};

//configure
var dbConfig = require('../config/dbConfig.json');

var pool = mysql.createPool(dbConfig);

//database query
data.renderQuery = (req, res, query, vars, nest) => {
	//console.log(query);
	var result;
	console.log(query);
	
	pool.getConnection(function(err, dbcon) {
		if (err) {
			console.log(err);
			return process.exit();
		}
		result = dbcon.query(query, vars, function(err, rows){
			if(err) {
				console.log(err);
				res.status(400);
				return data.render(req, res, [err]);
			}
			return data.render(req, res, rows, nest);
		});

		dbcon.release();
	});

	return result;
};
