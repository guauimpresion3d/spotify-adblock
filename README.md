# Spotify Desktop Adblocker

This project uses a Man-In-The-Middle proxy to strip all ad-related requests from the Spotify desktop application. This should 
work for all major operating systems, but if you are using Linux, I would advise you to use [this](https://github.com/abba23/spotify-adblock-linux) instead.  

## Installation & Usage Instructions

<details><summary>Click to expand for installation & usage.</summary>


Open desktop Spotify, open the dropdown from the top-right, and open settings. Scroll all the way down settings and find "Proxy" (you may need
to look under Advanced Settings).

Configure it as shown:

<img width="769" alt="image" src="https://user-images.githubusercontent.com/40674932/206878775-b732b90d-5ae3-41a1-9bb6-f30eab1ff1d4.png">

Run the following commands in terminal to clone and install. 
```
> git clone https://github.com/AnanthVivekanand/spotify-adblock.git && cd spotify-adblock
...
> npm i
```

Then start the proxy by running `node mitm.js`, which allows it to generate some certificates. Then, trust the 
root certificate at `certs/certs/ca.crt`

On MacOS, you can trust the root certficate with one command: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/certs/ca.crt`

After trusting, run `node mitm.js` to start the proxy again. You should see something similar to the image below.

  
</details>
  
<img width="1820" alt="image" src="https://user-images.githubusercontent.com/40674932/206879243-12d93628-17e2-49bb-b5af-7a71981bbdb8.png">

## How it works

`mitm.js` uses a Man-In-The-Middle proxy to decrypt SSL connections and filter out ad-related URLs and domains. All Spotify requests are routed through a locally hosted proxy, which evaluates every request against the allow-list (`src/utils/whitelist-mitm.ts`) and block-list (`src/utils/blacklist-mitm.ts`). On first run, `mitm.js` generates a root Certificate Authority (CA) that must be trusted by your OS for the proxy to function.

**Note:** The simpler "domain-filter" flow (`filter-domains.js`) has been removed from the main branch. If you still need it you can check out the last commit that contains it: https://github.com/AnanthVivekanand/spotify-adblock/commit/d2b6397369adc7607084a29abfca5dcde067adc4 .

# Docker image

To build an image for the MITM proxy, simply run `npm run docker-mitm`, and then create a container binding the port 8082 and the folder `/usr/src/app/certs` to the host to get access to the certificates.
The port 8082 is exposed by Docker for easier setup using a reverse-proxy.

For example:

```docker run -d --name=Spotify-adblock --volume=/opt/spotify-adblock/certs:/usr/src/app/certs -p 8082:8082 --restart=always spotify-adblock:latest```

,where /opt/spotify-adblock/certs is the path on the host machine where you will find the certificates you need to import.
