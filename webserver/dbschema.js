var sql = require('sql');

sql.setDialect('mysql');

/**
 * SQL definition for ipv6matrix.DomainPenetration
 */
exports.domainPen = sql.define({
	name: 'DomainPenetration',
	columns: ['date','country','tld','domains','domains6','www','ns','mx','ntp']
});

/**
 * SQL definition for ipv6matrix.Domains
 */
exports.domains = sql.define({
	name: 'Domains',
	columns: ['date','domain','country','www_hosts','www_hosts6','mx_hosts','mx_hosts6','ns_hosts','ns_hosts6','ntp_hosts','ntp_hosts6',
		'http4','http6','https4','https6','smtp4','smtp6','faster','pingratio','fewer','hopratio']
});

/**
 * SQL definition for ipv6matrix.HostData
 */
exports.hostData = sql.define({
	name: 'HostData',
	columns: ['date','country','tld','type','hosts','hosts4','hosts6','dualstack','noip',
		'pinghosts','faster','ping4','ping6','pathhosts','fewer','hops4','hops6']
});

/**
 * SQL definition for ipv6matrix.Reachability
 */
exports.reach = sql.define({
	name: 'Reachability',
	columns: ['date','country','tld','service','hosts4','hosts6','reach4','reach6']
});
