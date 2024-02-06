# Sandwich Bot

Watches for buy orders on QuickSwap (Polygon) for IXT from a specified address and then will also buy a random amount between 200-500 MATIC worth. This transaction will be sent with double the gas price of the original once in order to front run it. Once both transactions have settled then a sell order will be sent to sell all IXT held by the wallet.

Since this bot will only buy with MATIC it will only work on the IXT/MATIC pair on QuickSwap however it should be able to pick up buy orders from any pair as is.

This repo is a sample only and has not been tested. There are likely bugs and issues with it.

## Usage

1. copy .env.example to .env
2. fill in the .env file with your private key and rpc url
3. Make sure the wallet for your private key has at least 500 MATIC in it
4. run `yarn` to install dependencies
5. run `yarn start` to start the bot

NOTE: Double check the addresses in the top of the `index.js` file to make sure they are correct.

To leave this running on a server, you can use `pm2` or `forever` to keep the process running.
