-- MySQL dump 10.13  Distrib 8.0.26, for Linux (x86_64)
--
-- Host: localhost    Database: ipv6matrix
-- ------------------------------------------------------
-- Server version	8.0.26-0ubuntu0.20.04.2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `DomainPenetration`
--

DROP TABLE IF EXISTS `DomainPenetration`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `DomainPenetration` (
  `date` date NOT NULL,
  `country` varchar(2) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `tld` varchar(64) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `domains` int NOT NULL DEFAULT '0',
  `domains6` int NOT NULL DEFAULT '0',
  `www` int NOT NULL DEFAULT '0',
  `mx` int NOT NULL DEFAULT '0',
  `ns` int NOT NULL DEFAULT '0',
  `ntp` int NOT NULL DEFAULT '0'
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Domains`
--

DROP TABLE IF EXISTS `Domains`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Domains` (
  `date` date NOT NULL,
  `domain` varchar(128) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `country` varchar(2) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL DEFAULT 'ZZ',
  `www_hosts` int NOT NULL DEFAULT '0',
  `www_hosts6` int NOT NULL DEFAULT '0',
  `mx_hosts` int NOT NULL DEFAULT '0',
  `mx_hosts6` int NOT NULL DEFAULT '0',
  `ns_hosts` int NOT NULL DEFAULT '0',
  `ns_hosts6` int NOT NULL DEFAULT '0',
  `ntp_hosts` int NOT NULL DEFAULT '0',
  `ntp_hosts6` int NOT NULL DEFAULT '0',
  `http4` int NOT NULL DEFAULT '0',
  `http6` int NOT NULL DEFAULT '0',
  `https4` int NOT NULL DEFAULT '0',
  `https6` int NOT NULL DEFAULT '0',
  `smtp4` int NOT NULL DEFAULT '0',
  `smtp6` int NOT NULL DEFAULT '0',
  `faster` int NOT NULL DEFAULT '0',
  `pingratio` float NOT NULL DEFAULT '0',
  `fewer` int NOT NULL DEFAULT '0',
  `hopratio` float NOT NULL DEFAULT '0',
  KEY `domainsfull` (`domain`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `HostData`
--

DROP TABLE IF EXISTS `HostData`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `HostData` (
  `date` date NOT NULL,
  `country` char(2) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `tld` varchar(64) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `type` char(3) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `hosts` int NOT NULL DEFAULT '0',
  `hosts4` int NOT NULL DEFAULT '0',
  `hosts6` int NOT NULL DEFAULT '0',
  `dualstack` int NOT NULL DEFAULT '0',
  `noip` int NOT NULL DEFAULT '0',
  `pinghosts` int NOT NULL DEFAULT '0',
  `faster` int NOT NULL DEFAULT '0',
  `ping4` float NOT NULL DEFAULT '0',
  `ping6` float NOT NULL DEFAULT '0',
  `pathhosts` int NOT NULL DEFAULT '0',
  `fewer` int NOT NULL DEFAULT '0',
  `hops4` int NOT NULL DEFAULT '0',
  `hops6` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`date`,`country`,`tld`,`type`),
  KEY `country` (`country`),
  KEY `hosts` (`hosts`),
  KEY `date` (`date`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Reachability`
--

DROP TABLE IF EXISTS `Reachability`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Reachability` (
  `date` date NOT NULL,
  `country` varchar(2) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `tld` varchar(64) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `service` varchar(5) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `hosts4` int NOT NULL,
  `hosts6` int NOT NULL,
  `reach4` int NOT NULL,
  `reach6` int NOT NULL
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2021-08-20 10:26:08
