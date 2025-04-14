# Crypto Price MCP Server

An MCP server that provides cryptocurrency price information from CoinGecko using the TypeScript SDK.

## Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

## Usage

### Running the server directly

```bash
npm start
```

### Using the MCP CLI (if you have it installed)

```bash
mcp dev dist/index.js
```

## Available Tools

- `getCryptoPrice(cryptoId)`: Get the price of a single cryptocurrency
- `getMultipleCryptoPrices(cryptoIds)`: Get the prices of multiple cryptocurrencies (comma-separated)

## Available Resources

- `crypto://{cryptoId}/price`: Get the price of a cryptocurrency as a resource

## Available Prompts

- `checkCryptoPrice`: Creates a prompt to ask about a cryptocurrency's price

## Example Usage

```
# Get Bitcoin price
getCryptoPrice("bitcoin")

# Get multiple prices
getMultipleCryptoPrices("bitcoin,ethereum,solana")
```

## Supported Cryptocurrencies

The server supports all cryptocurrencies available on CoinGecko. Here are some common ones:

- bitcoin
- ethereum
- solana
- cardano
- dogecoin
- polkadot
- ripple (xrp)
- binancecoin
- avalanche-2 (avax)
- shiba-inu

For more IDs, refer to the URL path in CoinGecko's website (e.g., https://www.coingecko.com/en/coins/bitcoin). 