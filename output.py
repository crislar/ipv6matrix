import csv
import os
import mysql.connector
import globals

def processOutput(conn, outputDir, currentRun, onFeatures, config, tlds, onMetrics, screen):
    c = conn.cursor()
    run_mysql  = (config.get("mysql", "enabled") == "yes")
    mysqlc = None
    date = currentRun.split("_")[0]
    if (run_mysql):
        MYSQL_IP   = config.get("mysql", "mysql_host")
        MYSQL_USER = config.get("mysql", "mysql_user")
        MYSQL_PASS = config.get("mysql", "mysql_pass")
        MYSQL_DB   = config.get("mysql", "mysql_db")
        mysqldb = mysql.connector.connect(host=MYSQL_IP,user=MYSQL_USER,password=MYSQL_PASS,database=MYSQL_DB)
        mysqldb.autocommit = False
        mysqlc = mysqldb.cursor()
        mysqlc.execute("SELECT DISTINCT(tld) FROM HostData WHERE date = %s", (date, ))
        for tld in mysqlc:
            # Allow us to resume by committing a TLD all together, and then removing already committed TLDs
            print("Removing " + tld[0])
            tlds.remove(tld[0])
    for tld in tlds:
        os.makedirs(f"{outputDir}/{tld}/{currentRun}")
        if (run_mysql):
            generateReachability(c, mysqlc, date, tld, screen)
            generateDomains(c, mysqlc, date, tld, screen)
        for f in onFeatures:
            outputFile='%s/%s/%s/%s_%s.log' %(outputDir, tld, currentRun, f, tld) # crawls/com/2021-01-01__17-00-00/MX_com.log
            if f == 'MX' or f == 'NS':
                # We need priority for these, and don't need to check if they resolve because they came from DNS queries (so even if n/a n/a they are valid, as long as host != n/a)
                c.execute(f"select '{f}',  domain, job.host, ip4.ip, ip6.ip, priority from job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host WHERE job.type='{f}' AND job.host != 'n/a' AND job.tld = ?;", (tld, ))
            elif f == 'WWW' or f == 'NTP': 
                c.execute(f"select '{f}', domain, job.host, ip4.ip, ip6.ip from job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host WHERE job.type='{f}' AND job.tld = ? AND (ip4.ip || ip6.ip != 'n/an/a');", (tld, ))
            else:
                screen.info(f"Feature {f} is unimplemented")
                break
            output = c.fetchall()
            writeCSV(outputFile, output)
            metricDir = '%s/%s/%s' %(outputDir, tld, currentRun)
            generateHostData(c, mysqlc, date, tld, f, screen)
            if 'reverse' in onMetrics:
                processReverse(c, tld, f, metricDir)
            if 'geoip' in onMetrics:
                # Ideally the generateHostData would be done here, but if geoip is off we need the data anyway (with ZZ)
                processGeoIP  (c, tld, f, metricDir)
            if 'ip6Type' in onMetrics:
                processIp6Type(c, tld, f, metricDir)
            if (f == 'MX'):
                if 'tcp25' in onMetrics:
                    processTCP(c, tld, f, metricDir, "25")
                    processTLS(c, tld, f, metricDir)
            if (f == 'WWW'):
                if 'tcp80' in onMetrics:
                    processTCP(c, tld, f, metricDir, "80")
                if 'tcp443' in onMetrics:
                    processTCP(c, tld, f, metricDir, "443")
        if 'ping' in onMetrics:
            processPing   (c, tld, onFeatures, metricDir, mysqlc, date, screen)
        if 'path' in onMetrics:
            processPath   (c, tld, onFeatures, metricDir, mysqlc, date, screen)
        if (run_mysql):
            mysqldb.commit()
        # Add code here to check if SOA enabled
        processSOAOutput(c, tld, outputDir, currentRun)
    c.close()
    if (run_mysql):
        mysqldb.commit()
        mysqlc.close()


def generateReachability(c, mysqlc, date, tld, screen):
    c.execute("CREATE TEMPORARY TABLE tempreach (domain, host, country, type, ip4, ip6, tcp80_4, tcp80_6, tcp443_4, tcp443_6, tcp25_4, tcp25_6, UNIQUE(type, domain, host));")
    c.execute("CREATE INDEX IF NOT EXISTS type ON tempreach(type);")
    c.execute("INSERT INTO tempreach (domain, host, country, type, ip4, ip6) SELECT domain, job.host, country_code, job.type, ip4.ip, ip6.ip FROM job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host WHERE job.tld = ?;", (tld, ))
    c.execute("UPDATE tempreach SET country  = 'ZZ' WHERE country = 'n/a'");
    reachTypes = [("25", "SMTP", "SMTPS"), ("80", "WWW", "HTTP"), ("443", "WWW", "HTTPS")]
    for reachType in reachTypes:
        c.execute(f"UPDATE tempreach SET tcp{reachType[0]}_4  = True WHERE ip4 IN (SELECT ip FROM tcp WHERE port{reachType[0]}  = 'True' AND ip != 'n/a');")
        c.execute(f"UPDATE tempreach SET tcp{reachType[0]}_6  = True WHERE ip6 IN (SELECT ip FROM tcp WHERE port{reachType[0]}  = 'True' AND ip != 'n/a');")
        c.execute(f"SELECT ifnull(country, 'ZZ') as country, COUNT(ip4) as hosts4, COUNT(ip6) as hosts6, TOTAL(tcp{reachType[0]}_4) as reach4, TOTAL(tcp{reachType[0]}_6) as reach6 FROM tempreach WHERE type = '{reachType[1]}' GROUP BY country")
        for row in c:
            try:
                mysqlc.execute("INSERT INTO Reachability (date, tld, service, country, hosts4, hosts6, reach4, reach6) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)", (date,tld,reachType[2])+row)
            except Exception as e:
                screen.info(e)
    c.execute("DROP TABLE tempreach")

def generateDomains(c, mysqlc, date, tld, screen):
    query = """
    SELECT d.domain,
    (SELECT country_code FROM job JOIN ip4 ON job.host = ip4.host WHERE job.domain = d.domain LIMIT 1) as country,
    (SELECT COUNT(*) FROM job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host WHERE job.type = 'WWW' AND job.domain=d.domain AND (ip4.ip || ip6.ip != 'n/an/a')) as www_hosts,
    (SELECT COUNT(*) FROM job JOIN ip6 ON job.host = ip6.host WHERE job.type = 'WWW' AND job.domain=d.domain AND (ip6.ip != 'n/a')) as www_hosts6,
    (SELECT COUNT(*) FROM job WHERE job.type = 'NS' AND job.domain=d.domain) as ns_hosts,
    (SELECT COUNT(*) FROM job JOIN ip6 ON job.host = ip6.host WHERE job.type = 'NS' AND job.domain=d.domain AND (ip6.ip != 'n/a')) as ns_hosts6,
    (SELECT COUNT(*) FROM job WHERE job.type = 'MX' AND job.domain=d.domain) as mx_hosts,
    (SELECT COUNT(*) FROM job JOIN ip6 ON job.host = ip6.host WHERE job.type = 'MX' AND job.domain=d.domain AND (ip6.ip != 'n/a')) as mx_hosts6,
    (SELECT COUNT(*) FROM job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host WHERE job.type = 'NTP' AND job.domain=d.domain AND (ip4.ip || ip6.ip != 'n/an/a')) as ntp_hosts,
    (SELECT COUNT(*) FROM job JOIN ip6 ON job.host = ip6.host WHERE job.type = 'NTP' AND job.domain=d.domain AND (ip6.ip != 'n/a')) as ntp_hosts6,
    (SELECT COUNT(*) FROM job JOIN ip4 ON ip4.host = job.host JOIN tcp ON ip4.ip = tcp.ip WHERE tcp.ip != 'n/a' AND port80  = "True" AND job.domain=d.domain) as http4,
    (SELECT COUNT(*) FROM job JOIN ip6 ON ip6.host = job.host JOIN tcp ON ip6.ip = tcp.ip WHERE tcp.ip != 'n/a' AND port80  = "True" AND job.domain=d.domain) as http6,
    (SELECT COUNT(*) FROM job JOIN ip4 ON ip4.host = job.host JOIN tcp ON ip4.ip = tcp.ip WHERE tcp.ip != 'n/a' AND port443 = "True" AND job.domain=d.domain) as https4,
    (SELECT COUNT(*) FROM job JOIN ip6 ON ip6.host = job.host JOIN tcp ON ip6.ip = tcp.ip WHERE tcp.ip != 'n/a' AND port443 = "True" AND job.domain=d.domain) as https6,
    (SELECT COUNT(*) FROM job JOIN ip4 ON ip4.host = job.host JOIN tcp ON ip4.ip = tcp.ip WHERE tcp.ip != 'n/a' AND port25  = "True" AND job.domain=d.domain) as smtp4,
    (SELECT COUNT(*) FROM job JOIN ip6 ON ip6.host = job.host JOIN tcp ON ip6.ip = tcp.ip WHERE tcp.ip != 'n/a' AND port25  = "True" AND job.domain=d.domain) as smtp6
    """
    query += "FROM (SELECT DISTINCT domain as domain from job JOIN ip4 ON job.host = ip4.host WHERE tld = ?) as d;"
    c.execute(query, (tld, ))
    penData = {}
    chunk_size = 1000
    chunk_number = 1
    # Loading a chunk at a time reduces the risk of OOM, plus barely affects performance
    domains = c.fetchmany(chunk_size)
    while domains:
        domains   = [(row[0],) + ("ZZ" if row[1] == "n/a" else row[1],) + (row[2:]) for row in domains]
        insertData = [(date,)+row for row in domains]
        try:
            mysqlc.executemany("INSERT INTO Domains (date, domain, country, www_hosts, www_hosts6, ns_hosts, ns_hosts6, mx_hosts, mx_hosts6, ntp_hosts, ntp_hosts6, http4, http6, https4, https6, smtp4, smtp6) values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", insertData)
        except Exception as e:
            screen.info("Exception " + e + " inserting into Domains")
        #calculate domain penetration for each type
        for row in domains:
            if row[1] not in penData: penData[row[1]] = [0,0,0,0,0,0]
            country = penData[row[1]]
            country[0] += 1
            if row[3] or row[5] or row[7] or row[9]:
                country[1] += 1
                if row[3]: country[2] += 1
                if row[5]: country[3] += 1
                if row[7]: country[4] += 1
                if row[9]: country[5] += 1
        domains = c.fetchmany(chunk_size)
    #build and insert domain pen for each country
    insertData = [(date,tld,country)+tuple(data) for country, data in penData.items()]
    try:
        mysqlc.executemany("INSERT INTO DomainPenetration (date, tld, country, domains, domains6, www, ns, mx, ntp) values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",insertData)
    except Exception as e:
        screen.info("Exception " + e + " inserting into DomainPenetration")
    


def generateHostData(c, mysqlc, date, tld, feature, screen):
    # Generate HostData
    query =  "select ifnull(ip4.country_code, 'ZZ') as country, COUNT() as hosts,  SUM(ip4.ip != 'n/a' AND ip6.ip == 'n/a') as hosts4, SUM(ip4.ip == 'n/a' AND ip6.ip != 'n/a') as hosts6, SUM(ip4.ip != 'n/a' AND ip6.ip != 'n/a') as dualstack, SUM(ip4.ip == 'n/a' AND ip6.ip == 'n/a') as noip "
    query += "FROM job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host WHERE job.type=? AND job.tld = ? GROUP BY country;"
    c.execute(query, (feature, tld))
    if mysqlc is None:
        return
    for row in c:
        try:
            country_code = "ZZ" if row[0] == "n/a" else row[0]
            mysqlc.execute("INSERT INTO HostData (date, tld, type, country, hosts, hosts4, hosts6, dualstack, noip) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)", (date,tld,feature, country_code) + row[1:])
        except Exception as e:
            screen.info("Exception inserting %s into HostData" % str((date,tld,feature)+row))

def writeCSV(outputFile, output):
    with open(outputFile, 'w') as f:
        writer = csv.writer(f)
        writer.writerows(output)
    f.close()

def processReverse(c, tld, feature, outputDir):
    outputFile='%s/%s_%s.log' %(outputDir, f"reverse_{feature}", tld) # crawls/com/2021-01-01__17-00-00/reverse_MX_com.log
    c.execute("select 'reverse', domain, job.host, ip4.ip, ip6.ip, (SELECT reverse FROM rdns WHERE ip=ip4.ip), (SELECT reverse FROM rdns WHERE ip=ip6.ip) from job NATURAL JOIN ip4 JOIN ip6 ON job.host = ip6.host WHERE job.type=? AND job.tld = ?;", (feature, tld))
    output = c.fetchall()
    writeCSV(outputFile, output)


def processTCP(c, tld, feature, outputDir, port):
    outputFile='%s/%s_%s.log' %(outputDir, f"tcp{port}_{feature}", tld) # crawls/com/2021-01-01__17-00-00/tcp80_WWW_bb.log
    c.execute(f"select 'tcp{port}', domain, job.host, '{port}', ip4.ip, ip6.ip, (SELECT port{port} FROM tcp WHERE ip=ip4.ip), (SELECT port{port} FROM tcp WHERE ip=ip6.ip) from job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host WHERE job.type=? AND job.tld = ?;", (feature, tld))
    output = c.fetchall()
    writeCSV(outputFile, output)

def processIp6Type(c, tld, feature, outputDir):
    outputFile='%s/%s_%s.log' %(outputDir, f"ip6Type_{feature}", tld) # crawls/com/2021-01-01__17-00-00/ip6Type_MX_com.log
    c.execute("select 'ip6Type', domain, job.host, ip6.ip, valid, id, ip6.type from job JOIN ip6 ON job.host = ip6.host WHERE job.type=? AND job.tld = ? AND ip6.ip != 'n/a';", (feature, tld))
    output = c.fetchall()
    writeCSV(outputFile, output)

def processGeoIP(c, tld, feature, outputDir):
    outputFile='%s/%s_%s.log' %(outputDir, f"geoip_{feature}", tld) # crawls/com/2021-01-01__17-00-00/geoip_WWW_com.log
    c.execute("select 'geoip', domain, job.host, ip4.ip, ip6.ip, asn, city, region_name, country_code, longitude, latitude from job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host WHERE job.type=? AND job.tld = ? AND (ip4.ip || ip6.ip != 'n/an/a');", (feature, tld))
    output = c.fetchall()
    writeCSV(outputFile, output)

def processTLS(c, tld, feature, outputDir):
    # The original version of this code hasn't been run since 2010, and only returned/checked IPv4
    # The output is in the format tls, domain, host, ipv4, reachable?, isTLS?
    # Where isTLS is only from STARTTLS
    # In all likelihood, this metric won't be used anyway, but I've added to give another output metric
    # Instead of modifying the CSV to match other metrics (ie. having both IPv4 and IPv6 in the same line)
    # I've kept it backwards compatible and output two lines, one for IPv6, one for IPv4
    # However I didn't output IPv6 if n/a
    outputFile='%s/%s_%s.log' %(outputDir, f"tls_{feature}", tld) # crawls/com/2021-01-01__17-00-00/tls_MX_ws.log
    c.execute("select 'tls', domain, job.host, ip4.ip, port25, starttls FROM job JOIN ip4 ON job.host = ip4.host JOIN tcp ON ip4.ip = tcp.ip WHERE job.type = ? AND job.tld = ? UNION select 'tls', domain, job.host, ip6.ip, port25, starttls FROM job JOIN ip6 ON job.host = ip6.host JOIN tcp ON ip6.ip = tcp.ip WHERE job.type = ? AND ip6.ip != 'n/a' AND job.tld = ?", (feature, tld, feature, tld))
    output = c.fetchall()
    writeCSV(outputFile, output)

def processSOAOutput(c, tld, outputDir, currentRun):
    # This one doesn't use writeCSV because it checks here that it's not just "n/a" 7 times, rather than in MySQL.
    outputFile='%s/%s/%s/%s_%s.log' %(outputDir, tld, currentRun, "soa_NS", tld) # crawls/com/2021-01-01__17-00-00/soa_NS_com.log
    c.execute("select 'soa', host, primaryBySOA, primaryByRank, primaryInHouse, secondary, total, soa FROM soa WHERE tld = ?;", (tld, ))
    output = c.fetchall()
    with open(outputFile, 'w') as f:
        for out in output:
            out = ",".join([str(item) for item in out])
            if out != ",".join(["n/a"]*7):
                f.write(out + "\n")
    f.close()

def processPing(c, tld, onFeatures, outputDir, mysqlc, date, screen):
    # I want to start by saying I'm not proud of this code, but it works
    # The ping data is stored by IP in SQLite, so obviously different rows for ip4 and ip6
    # The output needs to be one row, with the IP4 first, then the IP6 after:
    # "ping", domain, job.host, ip4, ip6, count, min4, avg4, max4, mdev4, min6, avg6, max6, mdev6
    # Ideally I could just do:
    # SELECT 'ping', domain, job.host, ip4.ip, ip6.ip, (SELECT count, min, avg, max, mdev FROM ping WHERE ip=ip4.ip),
    #                                                  (SELECT count, min, avg, max, mdev FROM ping WHERE ip=ip6.ip)
    #                                                  FROM job NATURAL JOIN ip4 JOIN ip6 ON job.host = ip6.host WHERE job.type="WWW" AND job.domain LIKE "%.com";
    # But SQLite won't let me subselect more than one column, and joining to the same table twice results in duplicates
    # Next option is to bring the data back as two separate lists and join them in Python
    # However we'd be looking at storing two arrays of 1M+ rows, could be memory issues
    # Another alterative would be to select the IP4 data, then query each row in place to get the IP6 data
    # However we'd be looking at 1M+ extra SQLite rows, plus slower iterating
    # So I decided to go for the previous option, however get SQLite to run the additional queries itself
    # This way, we only get the rows back once, from a temporary table, and can process them as CSV as normal.
    # This is done by creating a temporary table with a primary key, inserting the majority of the data in,
    # then deliberately causing a primary key clash and using conflict resolution to update the columns.
    # It's ugly, but it works, and seemed like the least ugly option.
    c.execute("CREATE TEMPORARY TABLE tmp_ping (host PRIMARY KEY, type, ip4, ip6, country_code, count, min4, avg4, max4, mdev4, min6, avg6, max6, mdev6);")
    c.execute("INSERT INTO tmp_ping (host, type, ip4, country_code, ip6, count, min4, avg4, max4, mdev4) SELECT job.host, job.type, ip4.ip, ip4.country_code, ip6.ip, p4.count, p4.min, p4.avg, p4.max, p4.mdev from job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host JOIN ping p4 ON p4.ip=ip4.ip WHERE job.tld = ? GROUP BY job.host;", (tld, ))
    c.execute("INSERT INTO tmp_ping (host, min6, avg6, max6, mdev6) SELECT job.host, p6.min, p6.avg, p6.max, p6.mdev from job JOIN ip6 ON job.host = ip6.host JOIN ping p6 ON p6.ip=ip6.ip WHERE job.tld = ? ON CONFLICT (tmp_ping.host) DO UPDATE SET min6=excluded.min6, avg6=excluded.avg6, max6=excluded.avg6, mdev6=excluded.mdev6;", (tld, ))
    c.execute("CREATE INDEX IF NOT EXISTS type ON tmp_ping(type);")    
    for feature in onFeatures:
        c.execute("SELECT 'ping', domain, job.host, ip4, ip6, count, min4, avg4, max4, mdev4, min6, avg6, max6, mdev6 FROM job JOIN tmp_ping ON job.host = tmp_ping.host WHERE (ip4 || ip6 != 'n/an/a') AND job.type=? AND job.tld = ?;", (feature, tld))
        outputFile='%s/%s_%s.log' %(outputDir, f"ping_{feature}", tld) # crawls/com/2021-01-01__17-00-00/ping_WWW_com.log
        output = c.fetchall()
        writeCSV(outputFile, output)
        
    if mysqlc is None:
        c.execute("DROP TABLE tmp_ping")
        return

    c.execute("UPDATE tmp_ping SET country_code = 'ZZ' WHERE country_code == 'n/a';")
    
    # I know this is a duplicate loop, but needed the ZZ setting first
    for feature in onFeatures:
        c.execute("SELECT COUNT() as pinghosts, SUM(avg4>avg6) as faster, TOTAL(avg4) as ping4, TOTAL(avg6) as ping6, ifnull(country_code, 'ZZ') as country FROM tmp_ping WHERE avg4 NOT NULL AND avg6 NOT NULL AND type = ? GROUP BY country_code;", (feature, ))
        for row in c:
            try:
                mysqlc.execute("UPDATE HostData SET pinghosts=%s, faster=%s, ping4=%s, ping6=%s WHERE country=%s AND date=%s AND tld=%s AND type=%s", row + (date,tld,feature))
            except Exception as e:
                screen.info("Exception inserting %s into HostData" % str(row[0:-1]+(date,tld,feature)))
    
    query =   "SELECT d.domain, "
    query += "(SELECT IFNULL(SUM(avg4>avg6),0) as faster FROM job JOIN tmp_ping ON job.host = tmp_ping.host WHERE job.domain=d.domain AND avg4 != 'n/a' AND avg6 != 'n/a') as faster, "
    query += "(SELECT IFNULL(SUM(avg6)/SUM(avg4),0) as pingratio FROM job JOIN tmp_ping ON job.host = tmp_ping.host WHERE job.domain=d.domain AND avg4 != 'n/a' AND avg6 != 'n/a') as pingratio "
    query += "FROM (SELECT domain as domain from job WHERE job.tld = ?) as d;"
    c.execute(query, (tld, ))
    updateData = c.fetchall()
    updateData = list(set([x for x in updateData])) # There are duplicates, more efficient to de-duplicate here than with DISTINCT
    updateData = [(row[1:]) + (row[0],) + (date,) for row in updateData]
    try:
        mysqlc.executemany("UPDATE Domains SET faster = %s, pingratio = %s WHERE domain = %s AND date = %s", updateData)
    except Exception as e:
        screen.info("Exception " + e + " inserting into Domains")
    updateData = None
    c.execute("DROP TABLE tmp_ping")

def processPath(c, tld, onFeatures, outputDir, mysqlc, date, screen):
    # Need to do the same as ping again here
    c.execute("CREATE TEMPORARY TABLE tmp_path (host PRIMARY KEY, type, ip4, ip6, country_code, mtu4, hops4, path4, mtu6, hops6, path6);")
    c.execute("INSERT INTO tmp_path (host, type, ip4, country_code, ip6, mtu4, hops4, path4) SELECT job.host, job.type, ip4.ip, ip4.country_code, ip6.ip, p4.mtu, p4.hops, p4.path from job JOIN ip4 ON job.host = ip4.host JOIN ip6 ON job.host = ip6.host JOIN tracert p4 ON p4.ip=ip4.ip WHERE job.tld = ? GROUP BY job.host;", (tld, ))
    c.execute("INSERT INTO tmp_path (host, mtu6, hops6, path6) SELECT job.host, p6.mtu AS mtu, p6.hops, p6.path from job JOIN ip6 ON job.host = ip6.host JOIN tracert p6 ON p6.ip=ip6.ip WHERE job.tld = ? ON CONFLICT (tmp_path.host) DO UPDATE SET mtu6=excluded.mtu6, hops6=excluded.hops6, path6=excluded.path6;", (tld, ))
    c.execute("CREATE INDEX IF NOT EXISTS type ON tmp_path(type);")    
    for feature in onFeatures:
        c.execute("SELECT 'path', domain, job.host, ip4, ip6, mtu4, hops4, hops4, path4, mtu6, hops6, hops6, path6 FROM job JOIN tmp_path ON job.host = tmp_path.host WHERE (ip4 || ip6 != 'n/an/a') AND job.type=? AND job.tld = ?;", (feature, tld))
        outputFile='%s/%s_%s.log' %(outputDir, f"path_{feature}", tld) # crawls/com/2021-01-01__17-00-00/path_WWW_com.log
        output = c.fetchall()
        writeCSV(outputFile, output)
    
    if mysqlc is None:
        c.execute("DROP TABLE tmp_path")
        return
    
    c.execute("UPDATE tmp_path SET country_code = 'ZZ' WHERE country_code == 'n/a';")
    
    for feature in onFeatures:
        c.execute("SELECT COUNT() as pathhosts, SUM(hops4>hops6) as fewer, SUM(hops4) as hops4, SUM(hops6) as hops6, ifnull(country_code, 'ZZ') as country FROM tmp_path WHERE hops4 != 'n/a' AND hops6 != 'n/a' AND type = ? GROUP BY country_code;", (feature, ))
        for row in c:
            try:
                mysqlc.execute("UPDATE HostData SET pathhosts=%s, fewer=%s, hops4=%s, hops6=%s WHERE country=%s AND date=%s AND tld=%s AND type=%s", row + (date,tld,feature))
            except Exception as e:
                screen.info("Exception inserting %s into HostData" % str(row[0:-1]+(date,tld,feature)))

    query =   "SELECT d.domain, "
    query +=  "(SELECT IFNULL(SUM(hops4>hops6),0) as fewer FROM job JOIN tmp_path ON job.host = tmp_path.host WHERE job.domain=d.domain AND hops4 != 'n/a' AND hops6 != 'n/a') as fewer, "
    query +=  "(SELECT IFNULL(TOTAL(hops6)/TOTAL(hops4), 0) as hopratio FROM job JOIN tmp_path ON job.host = tmp_path.host WHERE job.domain=d.domain AND hops4 != 'n/a' AND hops6 != 'n/a') as hopratio "
    query += "FROM (SELECT domain as domain from job WHERE job.tld = ?) as d;"
    c.execute(query, (tld, ))
    updateData = c.fetchall()
    updateData = list(set([x for x in updateData]))
    updateData = [(row[1:]) + (row[0],) + (date,) for row in updateData]
    try:
        mysqlc.executemany("UPDATE Domains SET fewer = %s, hopratio = %s WHERE domain = %s AND date = %s", updateData)
    except Exception as e:
        screen.info("Exception " + e + " inserting into Domains")
    updateData = None
    c.execute("DROP TABLE tmp_path")
