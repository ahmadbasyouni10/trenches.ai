# Crypto Price MCP Server

An MCP server that provides cryptocurrency price information from CoinGecko.

## Installation

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Running the server directly

```bash
python crypto_price_server.py
```

### Using with the MCP CLI

```bash
# In development mode with the MCP Inspector
mcp dev crypto_price_server.py

# Install in Claude Desktop
mcp install crypto_price_server.py
```

## Available Tools

- `get_crypto_price(crypto_id)`: Get the price of a single cryptocurrency
- `get_multiple_crypto_prices(crypto_ids)`: Get the prices of multiple cryptocurrencies (comma-separated)

## Available Resources

- `crypto://{crypto_id}/price`: Get the price of a cryptocurrency as a resource

## Example Usage

```
# Get Bitcoin price
get_crypto_price("bitcoin")

# Get multiple prices
get_multiple_crypto_prices("bitcoin,ethereum,solana")
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