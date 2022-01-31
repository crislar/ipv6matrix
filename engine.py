import asyncio
import globals
import os

from dns.asyncresolver import Resolver
from dns               import resolver, reversename
from utils             import checkResolver, getOrSetRDNS

def runFeatures(runDir, inFile, onFeatures,screen,config, conn):
        #load domains
        domains  = set(loadDomains(inFile[1], config.get("domain","blacklist")))
        # Note, this only splits on the last . - eg. .co.uk will be uk
        # This is for backwards compatibility (and simplicity)
        tlds = set([domain.split(".")[-1] for domain in domains])
        count    = len(domains)
        screen.info(str(count) + " domains loaded from " + inFile[1])
        # If the SQLite database already exists, assume we crashed and restart from where we were
        # Do this by deleting from domains anything already existing in the database
        # This also allows us to share one database across multiple executions (eg. different input files)
        c = conn.cursor()
        c.execute("SELECT domain FROM job WHERE type = 'NTP'")  
        complete = c.fetchall()
        complete = set([x[0] for x in complete])
        domains = list(domains - complete)
        complete = None # Free memory
        if len(domains) < count:
            screen.info("SQLite database already exists, " + str(count - len(domains)) + " domains already crawled. Continuing with the remaining " + str(len(domains)))
        for f in onFeatures:
            # Go through each domain in chunks, to keep memory footprint lower
            for group in chunker(domains, int(config.get("domain","chunk_size"))):
                asyncio.run(getRecordsBulk(f, config, conn, group, screen))
        return tlds

# This function loads all the domains (or a chunk of them) and runs the getRecords asynchronously
# Ideally it wouldn't need to be chunked, but memory can be an issue.
# It only looks up MX and NS, guesses NTP and WWW, and inserts them all into an SQLite table for later processing
async def getRecordsBulk(type, config, conn, domains, screen):
    c = conn.cursor()
    if type == 'NTP' or type == "WWW":
        # These are all generated as regexes, no lookups yet. Just insert them into the job table
        prefixes = config.get(type, "prefixes").strip().split(',')
        for prefix in prefixes:
            rows = []
            for domain in domains:
                host = "%s.%s" % (prefix,domain)
                tld = domain.split(".")[-1]
                rows.append([type,domain,host,0,tld])
            conn.executemany("INSERT INTO job (type, domain, host, priority, tld) values (?, ?, ?, ?, ?)", rows);
            conn.commit()
    if type == "MX" or type == "NS":
        # These come from lookups, so look them up.
        res = Resolver()
        res.lifetime    = 5
        res.timeout     = 2
        res.nameservers = globals.NAMESERVERS
        await checkResolver(res, screen)
        sema = asyncio.Semaphore(int(config.get("domain","semaphore")))
        output = [getRecords(domain, type, res, c, sema) for domain in domains]
        await asyncio.gather(*output, return_exceptions=True)
    conn.commit()
    c.close()

# This function actually looks up DNS records and inserts them.
async def getRecords(target, recordType, res, c, sema):
    async with sema:
        try:
            answers = await res.resolve(target, recordType)
            answers = [answer.to_text().strip() for answer in answers]
        except:
            if recordType == "MX":
                answers = ["10 n/a"] # Priority is fake here but saves catching non-int everywhere
            else:
                answers = ["n/a"]

        if recordType == "MX":
            answers = [flipMxPair(answer.split()) for answer in answers]
            answers.sort(key=lambda x: int(x[1]))
        elif recordType == "NS":
            # Save a double SQLite lookup here by doing it at the same time as NS
            # Need to define the zip twice because in Python 3 it's iterable only once
            nameservers = zip(answers,range(1,len(answers)+1))
            answers     = zip(answers,range(1,len(answers)+1))
            try:
                soa = await res.resolve(target, "SOA")
                soa = soa[0].to_text().strip().split()
                soa = await processSOA(target, nameservers, c, soa)
            except:
                soa = ["n/a"]*8
            #processSOA(target, answers, c, soa)
        elif recordType == "A" or recordType =="AAAA":
            answers = answers[0]
            await getOrSetRDNS(answers, res, c)
        elif recordType == "PTR":
            answers = answers[0]

        for answer in answers:
            tld     = target.split(".")[-1]
            sqlArgs = (recordType, target, answer[0], answer[1], tld)
            c.execute("INSERT INTO job (type, domain, host, priority, tld) values (?, ?, ?, ?, ?)", sqlArgs)
    return ""

async def processSOA(domain, nameservers, c, soa):
    primaryByRank = 'n/a'
    primaryInHouse = 0
    total = 0
    # Example nameservers:
    #('ns1.google.com.', 1)
    #('ns2.google.com.', 2)
    #('ns3.google.com.', 3)
    #('ns4.google.com.', 4)
    for nameserver, priority in nameservers:
        total = total + 1
        if priority == 1:
            primaryByRank = nameserver
            if nameserver.rstrip(".").endswith(domain):
                # See if the namserver is a subdomain, ie. ns1.google.com : google.com
                primaryInHouse = 1
    secondary = total - 1 if total > 0 else 0 # Get the number of spare nameservers (ie. after the primary)
    tld = domain.split(".")[-1]
    c.execute("INSERT INTO soa (host, tld, primaryBySOA, primaryByRank, primaryInHouse, secondary, total, soa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (domain, tld, soa[0], primaryByRank, primaryInHouse, secondary, str(total), ",".join(soa[1:])))


def loadDomains(inFile, blacklist):
    with open(inFile, 'r') as f:
        lines = f.readlines()
    domains = [f.lstrip().rstrip() for f in lines]
    # Some domains shouldn't be crawled due to abuse reports
    with open(os.path.expanduser(blacklist), 'r') as f:
        lines = f.readlines()
    blacklist = [f.lstrip().rstrip() for f in lines]
    domains = [d for d in domains if not d.startswith('#') and d and d not in blacklist]
    return domains

def flipMxPair(t):
    return (t[1],int(t[0]))

def chunker(seq, size):
    return (seq[pos:pos + size] for pos in range(0, len(seq), size))
