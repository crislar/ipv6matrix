CONFIG_FILE = 'config.props'
V6_PREFIX_FILE = 'v6prefix.conf'
CRAWL_LOG="crawl"
PROCESSES_MEM_USAGE=0

NAMESERVERS = [ "::1" ]

features = [
            "NS",
            "MX",
            "WWW",
            "NTP"
            ]
metrics  = [
            "soa",
            "reverse",
            "ping",
            "tcp80",
            "tcp443",
            "tcp25",
            "tls",
            "path",
            "ip6Type",
            "geoip"
            ]
