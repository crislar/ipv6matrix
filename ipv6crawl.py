#!python3.7
"""
@idea_by: Olivier Crepin-LeBlond
@author: James Lawrie
"""

from utils import timeStamp, createDualLogger, loadConfigData, loadConfig, create_dns_table
from engine import runFeatures
from processIP import processIPs
from output import processOutput

import time
import sys
import logging
import globals

import resource
import sqlite3
import os

if __name__ == '__main__':
    
    t = time.time()
    
    #### ======================================
    #### Load the config.props
    #### ======================================     
    config = loadConfig(globals.CONFIG_FILE)

    
    #### ======================================
    #### IN/OUT dirs
    #### ======================================    
    inputDir=os.path.expanduser(config.get("dirs","inputDir"))
    if not os.path.isabs(inputDir):
        inputDir=os.path.abspath(inputDir)   
    if not os.path.exists(inputDir):
        print("inputDir not found %s" %inputDir)
        sys.exit(-1)   
    
    outputDir=os.path.expanduser(config.get("dirs","outputDir"))    
    if not os.path.isabs(outputDir):
        outputDir=os.path.abspath(outputDir)       
    if not os.path.exists(outputDir):
        os.makedirs(outputDir)
  
    #### ======================================
    #### Current Run & Symbolic link  "latest"
    #### ======================================    
    currentRun = timeStamp()

    screenLogger = createDualLogger(globals.CRAWL_LOG,currentRun,outputDir+'/')
    screenLogger.setLevel(logging.INFO)


    #### ======================================
    #### on FEATURES and METRICS
    #### ======================================    
    (features,metrics, onMetrics,onFeatures) = loadConfigData(config)  
    screenLogger.info("OnFeatures: "+str(onFeatures))
    screenLogger.info("OnMetrics: "+ str(onMetrics))
      
    #### ======================================
    #### Create or init the SQLite database
    #### ======================================
    conn = create_dns_table()

    #### ======================================
    #### FEATURES & Metrics RUN
    #### ======================================
    inFiles = [(os.path.getsize(inputDir+"/"+inFile),inFile.split('.')[0],  inputDir+"/"+inFile) for inFile in os.listdir(inputDir) if os.path.isfile(inputDir+"/"+inFile)]
    inFiles.sort()
    inFiles=[(inFile[1],inFile[2])for inFile in inFiles]
    ln=len(inFiles)
    i=0
    soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    resource.setrlimit(resource.RLIMIT_NOFILE, (65535, hard))
    for inFile in  inFiles:
        runTime=time.time()
        i+=1
        screenLogger.info("File # %s out of %s" %(i,ln))
        screenLogger.info("============= %s ==========="%inFile[0])
        screenLogger.info("Collecting DNS records")
        tlds = runFeatures(inFile, onFeatures, screenLogger, config, conn)
        partRunTime = time.time()
        screenLogger.info("DNS records collected: %.2f sec ---" %(time.time() - runTime)) 
        screenLogger.info("Looking up and processing IPs")
        processIPs(conn, config, screenLogger, onMetrics)
        screenLogger.info("IPs processed: %.2f sec ---" %(time.time() - partRunTime)) 
    partRunTime = time.time()
    screenLogger.info("Processing output into CSV and MySQL")
    if tlds:
        processOutput(conn, outputDir, currentRun, onFeatures, config, tlds, onMetrics, screenLogger)
    runTime=time.time() - runTime
    screenLogger.info("Done, total time: %.2f sec ---" %(runTime, )) 
        
    t = time.time() - t 
    os.rename("ips.db", f"{outputDir}/ips-{currentRun}.db")    
    screenLogger.info("--- Crawling Done : %.2f sec ---", t)        
        
