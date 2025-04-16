# Crypto Price & Trade Analysis Server

This MCP server provides cryptocurrency price information and Solana wallet trade analysis capabilities.

## Features

1. **Crypto Price Tracking**
   - Get real-time prices for any cryptocurrency
   - Support for multiple cryptocurrencies in a single request
   - Price caching to reduce API calls

2. **Solana Wallet Analysis**
   - Analyze trading history and performance
   - Generate end-of-day trading reports
   - Track profit/loss metrics
   - Monitor trading patterns

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
export HELIUS_API_KEY=your_helius_api_key
```

3. Start the server:
```bash
npm start
```

## Available Tools

### Crypto Price Tools

1. `getCryptoPrice`
   - Get price for a single cryptocurrency
   - Parameters:
     - `cryptoId`: The ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum', 'solana')

2. `getMultipleCryptoPrices`
   - Get prices for multiple cryptocurrencies
   - Parameters:
     - `cryptoIds`: Comma-separated list of cryptocurrency IDs

### Wallet Analysis Tools

1. `analyzeTrades`
   - Analyze trading history for a Solana wallet
   - Parameters:
     - `walletAddress`: The Solana wallet address to analyze

2. `getEndOfDayReport`
   - Generate detailed end-of-day trading report
   - Parameters:
     - `walletAddress`: The Solana wallet address to generate report for

## Example Usage

```typescript
// Get crypto price
const btcPrice = await server.getCryptoPrice({ cryptoId: 'bitcoin' });

// Get multiple crypto prices
const prices = await server.getMultipleCryptoPrices({ 
  cryptoIds: 'bitcoin,ethereum,solana' 
});

// Analyze trades for a wallet
const analysis = await server.analyzeTrades({
  walletAddress: 'YourSolanaWalletAddress'
});

// Get end of day report
const report = await server.getEndOfDayReport({
  walletAddress: 'YourSolanaWalletAddress'
});
```

## Resources

The server also provides the following resources:

1. `crypto://{cryptoId}/price`
   - Get price information for a specific cryptocurrency

2. `wallet://{address}/analysis`
   - Get trading analysis for a specific wallet address

## Dependencies

- @modelcontextprotocol/sdk
- axios
- zod

## Environment Variables

- `HELIUS_API_KEY`: Required for wallet analysis features (get one at https://helius.xyz)

## Notes

- Price data is cached for 1 minute to reduce API calls
- Wallet analysis requires a valid Helius API key
- Trade profit/loss calculations are simplified and may need refinement based on your needs
- The server uses stdio transport for communication 