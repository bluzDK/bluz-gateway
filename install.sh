curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash - # get latest nodejs

sudo apt-get install git bluetooth bluez libbluetooth-dev libudev-dev nodejs  # dependencies

sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)  # Allows us to use without root access

# From https://docs.npmjs.com/getting-started/fixing-npm-permissions, we want to set the global npm install directory to be in our user directory, so we don't need to use root permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Install the gateway
git clone https://github.com/bluzDK/bluz-gateway.git
npm install -g ./bluz-gateway

