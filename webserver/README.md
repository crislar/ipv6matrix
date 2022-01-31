# Apache

a2enmod proxy  
a2enmod proxy_http  

<VirtualHost *:80>  
	ProxyRequests On  
	ProxyPass / http://localhost:3000/  
	ProxyPassReverse / http://localhost:3000/    
</VirtualHost>  

# Node Server

npm install
npm run start (production) OR npm run dev (local development mode)

# Database

I've added a MySQL dump to create empty tables. ipv6matrix.sql  

Need to create node/config/dbConfig.json in the form:  
 
{  
    "host"     : "localhost",  
    "user"     : "whatever",  
    "password" : "whatever",  
    "database" : "ipv6matrix"  
}  
