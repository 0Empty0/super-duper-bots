# sui-devnet-nft-bot

This script allows you to mint SUI devnet NFTs

## Algoritm

1. Generating account
2. Requesting Sui from faucet (rate limited)
3. Mint Capy, buys accessories, addding to Capy, breeding Capys, listing new Capy
4. Minting other devnet NFTs
5. Logging link to explorer with minted NFTs

## Requeremets

<b>To run this bot you need to have HTTP proxy</b>

Mnemonics from generated accounts will be saved to file `mnemonics.txt`

## Setup bot

1. Download ZIP and extract it to a folder
2. Install node.js: `https://nodejs.org/en/` (LTS)
3. Paste your proxy in `config/proxy.txt` if file doesn't exist create it(ip:port@login:password)
4. Open folder with the bot in `cmd` or `bash`

```bash
cd <path to folder with script>
```

6. Install dependencies

```bash
npm install
```

7. Start

```bash
npm start
```
