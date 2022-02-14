import aiosmtplib
import asyncio
import geoip2.database
import mtrpacket
import os
import sqlite3
import socket
import time

import globals

from dns.asyncresolver import Resolver
from dns     import resolver, reversename
from icmplib import async_ping
from IPy     import IP
from ssl     import SSLCertVerificationError
from typing  import Tuple
from utils   import checkResolver, getOrSetRDNS

def processIPs(conn, config, screen, onMetrics):
    asyncio.run(getIPs(conn, config, screen, onMetrics))
    if "geoip" in onMetrics:
        with geoip2.database.Reader(os.path.expanduser(config.get("geoip","asndb"))) as asn_db:
            with geoip2.database.Reader(os.path.expanduser(config.get("geoip","citydb"))) as city_db:
                updateGeoIPs(conn, config, asn_db, city_db)

# This function goes through all of the job.hosts we've collected, and resolves them to A/AAAA records
# It then processes each IP (ping, tcp, tracert etc.)
async def getIPs(conn, config, screen, onMetrics):
    c    = conn.cursor()
    # Firstly we get a list of hosts which don't have a corresponding ip6.host entry
    # This allows us to resume in the case of crash
    c.execute('SELECT DISTINCT job.host FROM job LEFT OUTER JOIN ip6 ON job.host=ip6.host WHERE ip6.host is null')
    (typeDic,subnetDic) = loadV6Prefixconf(globals.V6_PREFIX_FILE, screen)
    res = Resolver()
    res.lifetime    = 5
    # Maybe this should be higher in IP lookups?
    # In host lookups we expected NXDOMAIN but not here
    res.timeout     = 2    
    res.nameservers = globals.NAMESERVERS
    chunk_size = int(config.get("ip","lookup_chunk_size"))
    chunk_number = 1
    # Loading a chunk at a time reduces the risk of OOM, plus barely affects performance
    lookups = c.fetchmany(chunk_size)
    screen.info("Getting A/AAAA records...")
    while lookups:
        # Ensure the resolver is still responding
        await checkResolver(res, screen)        
        sema = asyncio.Semaphore(int(config.get("ip","semaphore")))
        screen.info("Chunk: " + str(chunk_number * chunk_size) + " " + str(time.time()))
        chunk_number = chunk_number + 1
        output = [get_ips(domain[0], res, sema, conn, subnetDic, typeDic, onMetrics) for domain in lookups]
        await asyncio.gather(*output, return_exceptions=False)
        conn.commit()
        lookups = c.fetchmany(chunk_size)
    # Next, process each IP
    # This is done by checking all IPs with no pings (could be anything, everything per IP is committed together)
    query  = 'SELECT distinct(ip4.ip) FROM ip4 LEFT OUTER JOIN ping ON ip4.ip=ping.ip WHERE ping.ip is null UNION '
    query += 'SELECT distinct(ip6.ip) FROM ip6 LEFT OUTER JOIN ping ON ip6.ip=ping.ip WHERE ping.ip is null'
    c.execute(query)
    chunk_size = int(config.get("ip","process_chunk_size"))
    chunk_number = 1
    lookups = c.fetchmany(chunk_size)
    screen.info("Processing IP addresses...")
    while lookups:
        # Ensure the resolver is still responding
        await checkResolver(res, screen)
        sema = asyncio.Semaphore(int(config.get("ip","semaphore")))
        screen.info("Chunk: " + str(chunk_number * chunk_size) + " " + str(time.time()))
        chunk_number = chunk_number + 1
        output = [process_IP(ip[0], res, conn, sema, config, screen, onMetrics) for ip in lookups]
        await asyncio.gather(*output, return_exceptions=False)
        lookups = c.fetchmany(chunk_size)
    
# This function takes a domain and looks up the first A and AAAA record
# For AAAA it will additionally get the IPv6 subnet
async def get_ips(domain, res, sema, conn, subnetDic, typeDic, onMetrics):
    async with sema:
        c = conn.cursor()
        try:
            ip = await res.resolve(domain, 'A')
            inserted = 0 # If we get through them all and none were inserted, need to raise an exception to insert n/a
            for result in ip:
                result = result.to_text()
                try:
                    if IP(result).version() == 4:
                        inserted = 1
                        c.execute("INSERT INTO ip4 (host, ip, city, region_name, country_code, longitude, latitude, asn) values (?, ?, ?, ?, ?, ?, ?, ?)", tuple([domain, result] + (['n/a'] * 6)))
                        # The CSV schema and original code was only setup for one result, so that's all we're taking
                        # It still provides the data on IPv4 or IPv6 connectivity.
                        break
                except:
                    # This will probably be an error with the A record not being a valid IP, or SQLite insert error
                    # Either way, if there are more results let's try again
                    pass
            if inserted == 0:
                # If we got this far, all of the results/inserts were invalid. Raise an exception to get to the except below.
                raise ValueError("No valid IP addresses found")
        except Exception as e:
            try:
                c.execute("INSERT INTO ip4 (host, ip, city, region_name, country_code, longitude, latitude, asn) values (?, ?, ?, ?, ?, ?, ?, ?)", tuple([domain] + (['n/a'] * 7)))
            except:
                # Sometimes when we get exceptions, somehow the IP is looked up twice. It only happens around 1 in 2,000,000 times.
                # So I set a UNIQUE constraint instead.
                pass
        try:
            ip = await res.resolve(domain, 'AAAA')
            inserted = 0
            for result in ip:
                result = result.to_text()
                try:
                    if IP(result).version() == 6:
                        if "ip6Type" in onMetrics:
                            (valid, id, type) = getIPV6Subnet(ip, subnetDic, typeDic)
                        else:
                            (valid, id, type) = ('n/a', 'n/a', 'n/a')
                        inserted = 1
                        c.execute("INSERT INTO ip6 (host, ip, valid, id, type) values (?, ?, ?, ?, ?)", (domain, result, valid, id, type))
                        # The CSV schema and original code was only setup for one result, so that's all we're taking
                        # It still provides the data on IPv4 or IPv6 connectivity.
                        break
                except:
                    # This will probably be an error with the AAAA record not being a valid IP, or SQLite insert error
                    # Either way, if there are more results let's try again
                    pass
            if inserted == 0:
                raise ValueError("No valid IP addresses found")                
        except Exception as e:
            try:
                c.execute("INSERT INTO ip6 (host, ip, valid, id, type) values (?, ?, ?, ?, ?)", (domain, 'n/a', 'n/a', 'n/a', 'n/a'))
            except:
                # Sometimes when we get exceptions, somehow the IP is looked up twice. It only happens around 1 in 2,000,000 times.
                # So I set a UNIQUE constraint instead.
                pass
        try:
            c.close()
            conn.commit()
        except:
            # Don't want sqlite3.OperationalError: database is locked to cause the crawler to crash, there will be another commit later.
            return ""
        return ""

# Pull in all the metrics for a particular IP
async def process_IP(ip, res, conn, sema, config, screen, onMetrics):
    # Splitting this out here because it's cleaner to do all the IP-based stuff together
    async with sema:
        type = ""
        if ip == "n/a":
            return
        try:
            type = "ip" + str(IP(ip).version())
        except:
            return
        # First get the reverse DNS
        c = conn.cursor()
        try:
            if "reverse" not in onMetrics:
                raise ValueError("rdns not enabled")
            rdns = reversename.from_address(ip)
            rdns = await res.resolve(rdns, "PTR")
            rdns = rdns[0].to_text()
        except:
            rdns = "n/a"
        try:
            if "ping" not in onMetrics:
                ping = [ip, 5] + ["n/a"] * 4
            else:
                ping = await ping_ip(ip, int(config.get("ping", "count")))
        except Exception as e:
            screen.info(e)
            ping = [ip, 5] + ["n/a"] * 4
        ports = await check_tcp_ports(ip, int(config.get("tcp", "timeout")), onMetrics, int(config.get("tcp", "smtpTimeout")))
        if "path" in onMetrics:
            (path, hops) = await trace(ip, type, res, conn, c, config)
        else:
            hops = 0 # Enough to get n/a inserted below
        # Everything committed once here, so if ping exists, the IP has been processed
        if (hops == 0):
            c.execute("INSERT INTO tracert (ip, mtu, hops, path) values (?, ?, ?, ?)", ([ip] + (["n/a"] * 3)))
        else:
            c.execute("INSERT INTO tracert (ip, mtu, hops, path) values (?, ?, ?, ?)", (ip, 1500, hops, path))
        c.execute("INSERT OR IGNORE INTO rdns (ip, reverse) values (?, ?)", (ip, rdns))
        c.execute("INSERT INTO ping (ip, count, min, avg, max, mdev) values (?, ?, ?, ?, ?, ?)", ping)
        c.execute("INSERT INTO tcp (ip, port25, port80, port443, starttls) values (?, ?, ?, ?, ?)", (ip, ports[25], ports[80], ports[443], ports['starttls']))
        try:
            c.close()
            conn.commit()
        except:
            return
        return


async def ping_ip(ip, count):
    output = await async_ping(ip, count=count, interval=0.2, privileged=True) # For some reason, False gave permission denied.
    if (output.packet_loss == 1):
        # packet_loss is a float from 0 - 1, so 1 means 100% packet loss
        return([output.address, str(output.packets_sent)] + ["n/a"]*4)
    else:
        return([output.address, str(output.packets_sent), str(output.min_rtt), str(output.avg_rtt), str(output.max_rtt), str(output.jitter)])

# I did a manual traceroute here to be able to use async again, and prevent shelling out
# Essentially it sends the packets out with a TTL from 1 to MAXTTL (eg. 30), until they come back as the final destination
# It also only looks up rDNS once per IP, without relying on the local resolver to cache
async def trace(ip, type, res, conn, c, config):
    # I'm not happy about hardcoding the IPv6 here, but socket doesn't return it without an external connection (which could fail)
    #local_addr = socket.gethostbyname(socket.gethostname()) if type == "ip4" else "2a00:1098:88:b3::2:1"
    #Trace needs the local_up for some reason
    local_addr = config.get("trace", f"{type}_local")
    async with mtrpacket.MtrPacket() as mtr:
        # Traceroute on Linux uses TTL of 30 by default
        trace = ""
        hops = 0
        for ttl in range(1, int(config.get("trace", "max_ttl"))):
            result = await mtr.probe(ip, ttl=ttl, local_ip=local_addr, timeout=int(config.get("trace", "timeout")))
            responder = "no" if result.responder == None else result.responder
            if responder != "no":
                responder = await getOrSetRDNS(responder, res, c)
            if (ttl == 1):
                trace = responder
            else:
                trace += " --> " + responder
            if result.success:
                hops = ttl
                break
        conn.commit()
        return (trace, hops)

async def check_tcp_ports(host, timeout, onMetrics, smtpTimeout):
    # This doesn't take a list of ports from the config
    # It's more hardcoded, if updated here it will also need to be updated in the SQLite definition
    ports = { port : "False" for port in (25, 80, 443) }
    starttls = "False"
    for port in ports:
        if port == 25:
            # For port 25, use the smtp lib, which allows us to run starttls at the same time
            # Also, a lot of servers were listening on port 25 but not responding to EHLO
            # Previously these would have been considered valid.
            try:
                if "tcp25" not in onMetrics:
                    raise ValueError("tcp25 not enabled")
                smtp = aiosmtplib.SMTP(hostname=host, port=25, use_tls=False, timeout=timeout)
                await smtp.connect(timeout = smtpTimeout)
                ports[port] = "True"
                try:
                    # This will almost certainly throw an Exception because of IP not matching the cert.
                    await smtp.starttls()
                    starttls = "True"
                    await smtp.quit()
                except SSLCertVerificationError:
                    # This means the server responded with 220
                    starttls = "True"
                except Exception as e:
                    starttls = "False"
            except:
                starttls = "False"
        else:
            # Otherwise just open a TCP socket. If it opens, return True.
            try:
                if f"tcp{port}" not in onMetrics:
                    raise ValueError(f"tcp{port} not enabled")
                reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout)
                ports[port] = "True"
                writer.close()
                await writer.wait_closed()
            except:
                ports[port] = "False"
    ports['starttls'] = starttls
    return ports

# Decided to do after collecting the IPs because it can be memory intensive to load the GeoIP databases
# So this way we load the databases once, and then loop through each distinct IP
# It means another few million writes to SQLite, but that's not really an issue
def updateGeoIPs(conn, config, asn_db, city_db):
    read_cursor  = conn.cursor()
    write_cursor = conn.cursor()
    read_cursor.execute('SELECT DISTINCT ip FROM ip4 WHERE ip != "n/a"')
    for row in read_cursor:
        ipv4 = row[0]
        rs = ("n/a",)*5
        asn ="n/a"
        if ipv4 != 'n/a':
            try:
                response     = city_db.city(ipv4)
                city         = response.city.name
                region_name  = response.subdivisions.most_specific.name
                country_code = response.country.iso_code
                longitude    = response.location.longitude
                latitude     = response.location.longitude
                rs = (city or "n/a", region_name or "n/a", country_code or "n/a", longitude or "n/a", latitude or "n/a")
            except:
                rs =  tuple(['n/a']*5)
            try:
                response  = asn_db.asn(ipv4);
                as_number = response.autonomous_system_number
                as_name   = response.autonomous_system_organization
                asn       = f"AS{as_number} {as_name}" or "n/a"
                asn       = asn.replace('"','')
            except:
                asn ="n/a"
        query = "UPDATE ip4 SET " + ", ".join(f"{field} = ?" for field in ['city','region_name', 'country_code', 'longitude','latitude', 'asn']) + f" WHERE ip = ?"
        rs = rs + (asn, ipv4,)
        write_cursor.execute(query, rs)
    conn.commit()
    read_cursor.close()
    write_cursor.close()    

# Moved this to load the file once instead for each valid IPv6 address
# This function loads the v6 prefix file from globals.py
# Then creates two dictionaries
# One for types - I can't document this as there are no examples in the config file.
# The second is for masks, which turns eg:
# line =['U5060', ' simbx01', ' amis - Amis - http://www.amis.net/', ' si','2001:15c0:65ff::/48']
# Into:
# subnetDic{'2001:14b8:100::/48'} = [U5040, fihel01, dna - DNA Oy - http://www.dnaoy.fi, fi]
# eg. U5040, fihel01, dna - DNA Oy - http://www.dnaoy.fi, fi, 2001:14b8:100::/48
def loadV6Prefixconf(CONFIG_FILE, screen):
    with open(CONFIG_FILE, 'r') as f:
        lines = f.readlines()
    lines  = [line.strip() for line in lines]
    lines  = [line for line in lines if not line.startswith("#") and  line !="" ]
    # line =['U5060', ' simbx01', ' amis - Amis - http://www.amis.net/', ' si','2001:15c0:65ff::/48']
    types=[]
    masks=[]
    for line in lines:
        if line.startswith('%%'):
            types.append(line)
        else:
            masks.append(line)

    # There are no types in the file but leaving the logic in
    types  = [ [e.strip() for e in type.split(':')] for type in types]
    # eg. U5040, fihel01, dna - DNA Oy - http://www.dnaoy.fi, fi, 2001:14b8:100::/48
    masks  = [ [e.strip() for e in mask.split(',')] for mask in masks]
    typeDic={}
    subnetDic={}
    for type in types:
        if len(type)==2:
            (prefix,ipv6type)=type
            prefix = tuple(prefix.split('-'))
            typeDic[prefix]=ipv6type
        else:
            screen.info("Invalid line in v6prefixconfig: " + ":".join(type))
    for mask in masks:
        if len(mask) == 5:
            subnetMask=mask[4]
            subnetDic[subnetMask]=mask[:4]
        else:
            screen.info("Invalid line in v6prefixconfig: " + ",".join(mask))
    return (typeDic,subnetDic)


# This is from the original code, I didn't rewrite this except to bring it inline for Python 3
def getIPV6Subnet(ipv6, subnetDic, typeDic):
#    (_, _, domain, host, _, ipv6) = args[:6]
    id='n/a'
    type='n/a'
    valid='n/a'
    try:
        ipv6 = IP(ipv6)
        valid = True
    except:
        valid = False
    if valid:
        for k in subnetDic.keys():
            try:
                k_ip = IP(k)
                if ipv6 in k_ip:
                    subnetData = subnetDic[k]
                    id         = subnetData[0]
                    break
                else:
                    type = "undefined"
            except:
                type = "undefined"
        if id != 'n/a':
            type ="undefined"
            for k1,k2 in typeDic.keys():
                if id>=k1 and id<k2:
                    type=typeDic[(k1,k2)]
                    break
    return (valid,id,type)
