import asyncio
import configparser
import datetime
import logging
import os
import sqlite3
import sys
import time

import globals

from dns     import reversename
from logging import Logger


def loadConfig(CONFIG_FILE=globals.CONFIG_FILE):
    if not os.path.exists(os.path.expanduser(CONFIG_FILE)):
        sys.stderr.write("no config.props found!!")
        sys.exit(-1)
    config = configparser.ConfigParser()
    config.readfp(open(CONFIG_FILE))
    return config

def loadConfigData(config):
    features =globals.features
    metrics = globals.metrics
    metricFilters = {}
    onFeatures =[feature.strip() for feature in features if config.get("features", feature)=="on" ]
    onMetrics = [metric.strip()  for metric in metrics if config.get("metrics", metric)=="on"]
    return (features,metrics,onMetrics,onFeatures)

def createDualLogger(name,timestamp="", baseDir=""):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    if timestamp:
        name = name + "_" + timestamp
    ch = logging.FileHandler(baseDir+name+".log","w")
    formatter = logging.Formatter("%(message)s")
    ch.setFormatter(formatter)
    logger.addHandler(ch)
    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    logger.addHandler(ch)
    
    return logger

def timeStamp():
    return str(datetime.datetime.now()).replace(" ","__").replace(":","-").split(".")[0]

def create_dns_table():
    conn = None;
    try:
        conn = sqlite3.connect('ips.db')
        c    = conn.cursor()
        c.execute("CREATE TABLE IF NOT EXISTS soa  (host, primaryBySOA, primaryByRank, primaryInHouse, secondary, total, soa, tld)")
        # We only take the first IP, so if this UNIQUE fails, something went wrong.
        c.execute("CREATE TABLE IF NOT EXISTS ip4  (host UNIQUE, ip, asn, city, region_name, country_code, longitude, latitude)")
        c.execute("CREATE TABLE IF NOT EXISTS ip6  (host UNIQUE, ip, valid, id, type)")
        c.execute("CREATE TABLE IF NOT EXISTS job  (type, domain, host, priority, tld, UNIQUE(type, domain, host))")
        c.execute("CREATE TABLE IF NOT EXISTS ping (ip PRIMARY KEY, count, min, avg, max, mdev)")
        c.execute("CREATE TABLE IF NOT EXISTS rdns (ip PRIMARY KEY, reverse)")
        c.execute("CREATE TABLE IF NOT EXISTS tcp  (ip PRIMARY KEY, port25, port80, port443, starttls)")
        c.execute("CREATE TABLE IF NOT EXISTS tracert (ip PRIMARY KEY, mtu, hops, path)")
        c.execute("CREATE INDEX IF NOT EXISTS host    ON job(host);")
        c.execute("CREATE INDEX IF NOT EXISTS domain  ON job(domain);")
        c.execute("CREATE INDEX IF NOT EXISTS host4   ON ip4(host);")
        c.execute("CREATE INDEX IF NOT EXISTS host6   ON ip6(host);")
        c.execute("CREATE INDEX IF NOT EXISTS v4ip    ON ip4(ip);")
        c.execute("CREATE INDEX IF NOT EXISTS v6ip    ON ip6(ip);")
        c.execute("CREATE INDEX IF NOT EXISTS type3   ON job(host, type, domain);")
        c.execute("CREATE INDEX IF NOT EXISTS tld     ON job(tld);")
        c.execute("CREATE INDEX IF NOT EXISTS typetld ON job(type, tld);")
        c.execute("CREATE INDEX IF NOT EXISTS type ON job(type);")
        # Makes processing a little simpler later
        c.execute("INSERT OR IGNORE INTO rdns    (ip, reverse) VALUES ('n/a', 'n/a');")
        c.execute("INSERT OR IGNORE INTO ping    (ip, count, min, avg, max, mdev) VALUES ('n/a', 'n/a', 'n/a', 'n/a', 'n/a', 'n/a');")
        c.execute("INSERT OR IGNORE INTO tcp     (ip, port25, port80, port443, starttls) VALUES ('n/a', 'n/a', 'n/a', 'n/a', 'n/a');")
        c.execute("INSERT OR IGNORE INTO tracert (ip, mtu, hops, path) VALUES ('n/a', 'n/a','n/a', 'n/a')")
        return conn
    except Exception as e:
        print(e)
        sys.exit(-1)   


async def checkResolver(res, screen):
    # This just checks a resolver can resolve google.com without timing out
    # And sleeps until it can. Preventing a locked resolver causing n/a everywhere.
    while True:
        try:
            await res.resolve('google.com', 'A')
            break
        except Exception as e:
            screen.info("The DNS resolver does not appear to be responding. Waiting 60 seconds. If this message repeats consider restarting the resolver: " + str(e))
            time.sleep(60)


# This function returns an rDNS entry for an IP, either from the database or from DNS (which is updated into the database)
async def getOrSetRDNS(ip, res, c):
    c.execute("SELECT reverse FROM rdns WHERE ip=?", (ip, ))
    output = c.fetchone()
    if output is None:
        try:
            output = reversename.from_address(ip)
            output = await res.resolve(output, "PTR")
            output = output[0].to_text().rstrip(".")
        except:
            # This made more sense than n/a because it can be directly used in traceroute output
            output = ip
        # Due to concurrency, there's a chance rdns will be checked twice for the same IP
        try:
            c.execute("INSERT OR IGNORE INTO rdns (ip, reverse) values (?, ?)", (ip, output))
        except:
            pass
    else:
        output = output[0]
    return output