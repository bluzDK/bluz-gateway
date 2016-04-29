# Bluz Gateway for NodeJS
[![NPM](https://nodei.co/npm/bluz-gateway.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/bluz-gateway/)

[Bluz](http://bluz.io/) is a Bluetooth LE development kit that connects low cost, low energy sensors to the Internet of Things. Each bluz DK can hook to the [Particle](https://www.particle.io/) cloud and be controlled through a REST API, receive Over the Air firmware updates, and integrate with third party services such as IFTTT. 

Using gateway solutions, bluz can stay online without the need of a smartphone, allowing users to create battery powered project that can stay online for months or years, and always be accessible. 

This project turns a Raspberry Pi or C.H.I.P. into a gateway, allowing it to be the central hub for the entire network of devices. 

## Basic installation on Linux
For Debian-like Linuxes (Raspbian, C.H.I.P.), global install method.  You should just be able to copy and paste this into a shell.  If you already have Node installed, skip the first line.

```bash
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash - # get latest nodejs

sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev nodejs  # dependencies

sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)  # Allows us to use without root access

# From https://docs.npmjs.com/getting-started/fixing-npm-permissions, we want to set the global npm install directory to be in our user directory, so we don't need to use root permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Install the gateway
npm install -g bluz-gateway
```

The gateway is installed, so let's run it with `bluz-gateway`.  Assuming that everything went well, you should see a few lines of text describing the devices it's found, and no errors. Press `Ctrl-C` to exit. Now, let's set it up to run at boot.

```bash
# Change username in startup script, and copy to init folder
sed 's/OUR_USER_NAME/'$USER'/'  ~/.npm-global/lib/node_modules/bluz-gateway/example/init-script/bluz-gateway | sudo tee /etc/init.d/bluz-gateway

# Add to run at start
sudo update-rc.d bluz-gateway defaults
```
You should now be able to start it up with `sudo /etc/init.d/bluz-gateway start`, and view the log file at `/var/log/bluz-gateway.log`

## Updating
```bash
npm update -g bluz-gateway
sudo /etc/init.d/bluz-gateway restart
```

## Config
Upon first startup, the program creates a config file at `~/.bluz-gw/config.json`

 - `serverPort`: Changes the port that the info server runs on
 - `serverEnabled`: Enables/disables the info server
 - `blacklist`: An array of BL MAC addresses of DKs we should not connect to
 - `cloud:host` and `:port`: If you want to run a local cloud
 - `DEBUG`: debug levels -
	 - `error`: show only errors
	 - `warn`: default, only shows very basic info
	 - `info`: shows up and down packet events
	 - `debug`: a lot
	 - `trace`: really a lot

## Info Server
Upon startup the gateway starts a very basic REST-like server on port 3000 (default).  It currently has commands of (with host_addr being localhost, or ip address of the server):

 - `GET http://host_addr:3000/connected-device` Returns connected device info
 - `GET http://host_addr:3000/blacklist` Currently blacklisted devices
 - `POST text/plain  http://host_addr:3000/blacklist` Add a device to blacklist (12 digit hexadecimal MAC address in POST text/plain body, probably gotten from connected-devices)
 - `DELETE http://host_addr:3000/blacklist/:id` Delete a device from blacklist

## Protocol
[See wiki](https://github.com/mumblepins/bluz-gateway/wiki/General-Info-about-Bluz-Gateway-Protocol).
