# ISOC IPv6 Crawler Instructions
## Crawler
### Installation and Requirements
The crawler can be downloaded from <git link here once ready>
It requires Python3 and the following dependencies:
```
pip install aiosmtplib
pip install geoip2
pip install mtrpacket
pip install dnspython
pip install icmplib
pip install IPy
pip install mysql-connector-python
```

Due to traceroute and ping needing to open raw sockets, the following privilege will need to be granted to python3 if not running as root (please note this permission will apply to any Python3 script on the machine:
`setcap cap_net_raw+ep $(realpath $(which python3))`

Finally, due to a bug in dnspython, a library will need patching manually to prevent intermittent DNS exceptions (around 1 in 1000). The location of the file will differ depending on pip installations and Python subversions but it will be something like:
`~/.local/lib/python3.9/site-packages/dns/_asyncio_backend.py`

On line 28:
`	if self.recvfrom:`
Needs to be:
`	if self.recvfrom and not self.recvfrom.done():`

Note this may have already been updated, it was reported as a bug and patched: https://github.com/rthalley/dnspython/issues/740

Additionally, GeoIP2 databases are needed. To download them you’ll need a free account with Maxmind: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data?lang=en
Then download the mmdb formats of  GeoLite2-City and GeoLite2-ASN  and set the location in config.props:

```
[geoip]
asndb  = ~/crawler/GeoLite2-ASN.mmdb
citydb = ~/crawler/GeoLite2-City.mmdb
```

### Configuration
The configuration is mostly in `config.props`.  There is commentary in there, but you’ll need to set the IP4 and IP6 address under [trace]:
```
[trace]
max_ttl   = 30
timeout   = 2
ip4_local = 46.235.231.117
ip6_local = 2a00:1098:88:b3::2:1
```
This is for traceroute, as the starting IP needs to be set and trying to determine this programmatically proved to be unreliable - sometimes taking the wrong interface - unless an external connection was made, and I didn’t want to rely on connectivity of an external provider.

Please also set the name servers to use in `globals.py`:
`NAMESERVERS = [ "::1" ]`
We recommend running a local resolver to save overloading your provider, but any nameservers provided here will be used. Note that if this isn’t updated, and ::1 isn’t available, the crawler will still run but return n/a for everything.

The MySQL configuration under `[mysql]` is for where to write summary data for the webserver. Due to how long this takes to import, I recommend using a staging database for this, and importing to the live site later (covered below).

### Running a crawl
To run a crawl, cd into the directory containing the crawler, and run `./runCrawler`.

This shell script will check `./domains/` for files. If empty, it will download the top million sites from Majestic Million and write the domains into `./domains/million.txt` (note this is a naive assumption, it doesn’t check config.props below). If it isn’t empty, the domains are not download.

It’s possible to provide chunks of domains per file in the source directory, but there is no need to do this - the crawler can handle a million domains on a VM with 1GB RAM (more is needed if running your own resolver).

Next it runs the crawler which:
1. Creates or initialises an SQLite database called `ips.db`
2. Iterates through each file in the folder specified in `[dirs].inputdir` (in `config.props`, by default set to `~/ipv6data/crawler/domains`), and run each of the following steps against each file before moving onto the next one. Each file should have a domain per line.
3. It then runs `runFeatures` from `engine.py`, which loads all of the domains from the provided file and files the `job` table with MX and NS records. It additionally guesses NTP and WWW records (using prefixes from config.props)  and inserts these into the `job` table. No A or AAAA records are resolved in this step. Note that each of these can be turned on or off in the `config.props`
4. Next, it runs `processIPs`  from `processIP.py`. This iterates through each unique host from the job table - the idea being that there are a lot of non-unique records here, such as the amount of domains using cloudflare for WWW or Gmail for MX. It will resolve the A and AAAA records for each, and then for each unique IP (again, a lot of these are shared), it runs the metrics (such as traceroute, ping, reverse DNS).
5. Finally it runs `processOutput` from `output.py`. This does two things - writing CSV output into `[dirs].outputdir` (default `~/ipv6data/crawls`, secondly generating MySQL summary data for the webserver (unless disabled). Please note that output can only be generated if `ips.db` still exists.
6. Finally the script moves ips.db into the crawls directory with a timestamp.

By default, the MySQL summary data will be in the `ipv6matrix_staging` database. To bring it live for the webserver, assuming on the same server:
```
BEGIN;
INSERT INTO ipv6matrix.Domains SELECT * FROM ipv6matrix_staging.Domains;
INSERT INTO ipv6matrix.DomainPenetration SELECT * FROM ipv6matrix_staging.DomainPenetration;
INSERT INTO ipv6matrix.HostData SELECT * FROM ipv6matrix_staging.HostData;
INSERT INTO ipv6matrix.Reachability SELECT * FROM ipv6matrix_staging.Reachability;
COMMIT;
```

Once you’re happy the data is showing, delete the tables:
```
BEGIN;
TRUNCATE TABLE ipv6matrix_staging.Domains;
TRUNCATE TABLE ipv6matrix_staging.DomainPenetration;
TRUNCATE TABLE ipv6matrix_staging.HostData;
TRUNCATE TABLE ipv6matrix_staging.Reachability;
COMMIT;
```
### Resuming a crawl
If `ips.db` already exists, the crawler assumes that the previous crawl either crashed or was killed, and attempts to resume. It first removes any domains from the list to be crawled if they already exist in the `jobs` table. It then only processes IPs hosts which have a null `ip6.ip` (if IPv6 failed it would be “n/a”).

If you don’t want this to happen, remove or rename ips.db.

### SQLite Schema
The schema is as follows:
```
CREATE TABLE soa  (host, primaryBySOA, primaryByRank, primaryInHouse, secondary, total, soa);
CREATE TABLE ip4  (host, ip, asn, city, region_name, country_code, longitude, latitude);
CREATE TABLE ip6  (host, ip, valid, id, type);
CREATE TABLE job  (type, domain, host, priority, UNIQUE(type, domain, host));
CREATE TABLE ping (ip PRIMARY KEY, count, min, avg, max, mdev);
CREATE TABLE rdns (ip PRIMARY KEY, reverse);
CREATE TABLE tcp  (ip PRIMARY KEY, port25, port80, port443, starttls);
CREATE TABLE tracert (ip PRIMARY KEY, mtu, hops, path);
```

Essentially there is a table, `job`, to hold all of the records minus A/AAAA records, so all MX, WWW, NTP and MX records will be listed here.
The exception being `SOA`, which has its own table.
Then there are `ip4` and `ip6` tables which map hostnames to IP addresses (the purpose being so that each IP is only analysed once)
Finally, there are a number of tables for IP analysis - `ping`, `dns`, `tcp` (for connectivity to various ports), and `tracert`.

## Maintenance
* The GeoIP databases should be updated periodically
* The crawls directory should be backed up (I’d recommend taking the full home directory)
* If the disk starts filling up, crawls/ip*db can be deleted. This will prevent the output script being run again, but it is possible to recreate the ip.db from the CSV files if necessary (the functionality would need implementing)
* MySQL on the webserver should be backed up after every crawl, but daily is safer.
* Everything else can be restored from git.

## Webserver
The webserver can be downloaded from <git repo needed here>

### Apache Configuration
First enable proxying:
`a2enmod proxy`
`a2enmod proxy_http`

Overwrite the default vhost (feel free to customise this):
```
<VirtualHost *:80>
	ProxyRequests On
	ProxyPass / http://localhost:3000/
	ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

Restart apache2. Probably either `systemctl restart httpd` or `systemctl restart apache2`

### Node configuration
Install node (instructions for Debian):
`curl -sL https://deb.nodesource.com/setup_16.x | bash`
`apt-get update`
`apt-get install nodejs`

Install pm2:
`npm install pm2 -g`

Create a directory for node to run from:
`mkdir -p /var/www/node`

Create a user to run node as:
`useradd -d /var/www/node node`

Clone the gitlab repo into `/var/www/node/webserver` (instructions not provided as this will differ depending on the repository used and access options), but ensure the entire directory is owned by node:node:
`chown -R node:node /var/www/node/webserver` 

Next install MySQL. Instructions for this are outside scope, but wherever you choose to install it, create the required tables with `ipv6matrix.sql`, configure a user, and add the connection details into `config/dbConfig.json` in the form:
```
{
    "host"       : "localhost",
    "user"       : "matrixuser",
    "database"   : "matrix",
    "password"   : "supersecurepassword"
}
```


`su node —shell=/bin/bash`
`cd /var/www/node/webserver`
`pm2 start server.js`

You should now see the server running:
`pm2 list`

It can be stopped and started with `pm2 start server` and `pm2 stop server` respectively.

To ensure it comes up after a reboot, run as root:
`/usr/local/bin pm2 startup -u safeuser`

You’ll need to manually edit the systemd as the above command expects sudo to set the paths correctly, which it didn’t have.

Edit `/etc/systemd/system/pm2-node.service`
Change the following two lines to have the correct path:
```
Environment=PM2_HOME=/var/www/node/.pm2
PIDFile=/var/www/node/.pm2/pm2.pid
```

Then: `systemctl daemon-reload`.

The app should now automatically restart, and come back after reboot, without needing root.

