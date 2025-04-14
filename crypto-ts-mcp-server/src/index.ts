import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

// Create an MCP server
const server = new McpServer({
  name: "CryptoPriceServer",
  version: "1.0.0"
});

// Type for cryptocurrency data
interface CryptoPrice {
  name: string;
  symbol: string;
  price: number;
  currency: string;
  source: string;
}

// Cache system for API responses
const priceCache: Record<string, {data: CryptoPrice, timestamp: number}> = {};
const CACHE_TTL = 60000; // 1 minute cache

// Popular cryptocurrency IDs for suggestions
const POPULAR_CRYPTOS = [
  'bitcoin', 'ethereum', 'solana', 'cardano', 
  'dogecoin', 'xrp', 'polkadot', 'shiba-inu',
  'bnb', 'tron', 'litecoin', 'polygon', 'avalanche-2'
];

/**
 * Get cryptocurrency price from multiple APIs with fallback mechanisms
 */
async function getCryptoPrice(cryptoId: string): Promise<CryptoPrice | { error: string }> {
  // Normalize input
  const id = cryptoId.toLowerCase().trim();
  
  // Check cache first to avoid unnecessary API calls
  if (priceCache[id] && (Date.now() - priceCache[id].timestamp) < CACHE_TTL) {
    console.log(`🔵 CACHE HIT: Using cached data for ${id}, cached at ${new Date(priceCache[id].timestamp).toISOString()}`);
    return priceCache[id].data;
  }
  
  // Try CoinGecko API first (most reliable)
  try {
    console.log(`🟢 API CALL: Fetching live price for ${id} from CoinGecko`);
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
      params: {
        ids: id,
        vs_currencies: 'usd',
        include_market_cap: 'false',
        include_24hr_vol: 'false',
        include_24hr_change: 'false',
        include_last_updated_at: 'false'
      },
      timeout: 5000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MCP Crypto Server'
      }
    });
    
    if (response.status === 200 && response.data && response.data[id] && response.data[id].usd) {
      console.log(`✅ API SUCCESS: Got price for ${id}: $${response.data[id].usd}`);
      
      // Get proper name and symbol info
      let name = id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ');
      let symbol = id.toUpperCase().replace(/-/g, '');
      
      // For some common cryptocurrencies, provide better names/symbols
      if (id === 'bitcoin') { name = 'Bitcoin'; symbol = 'BTC'; }
      else if (id === 'ethereum') { name = 'Ethereum'; symbol = 'ETH'; }
      else if (id === 'solana') { name = 'Solana'; symbol = 'SOL'; }
      else if (id === 'cardano') { name = 'Cardano'; symbol = 'ADA'; }
      else if (id === 'dogecoin') { name = 'Dogecoin'; symbol = 'DOGE'; }
      else if (id === 'xrp') { name = 'XRP'; symbol = 'XRP'; }
      else if (id === 'polkadot') { name = 'Polkadot'; symbol = 'DOT'; }
      else if (id === 'litecoin') { name = 'Litecoin'; symbol = 'LTC'; }
      
      const result: CryptoPrice = {
        name,
        symbol,
        price: parseFloat(parseFloat(response.data[id].usd).toFixed(2)),
        currency: "USD",
        source: "coingecko-api"
      };
      
      // Update cache
      priceCache[id] = {
        data: result,
        timestamp: Date.now()
      };
      
      return result;
    } else {
      throw new Error("Invalid API response from CoinGecko");
    }
  } catch (error: any) {
    const isRateLimit = 
      error.message?.includes('429') || 
      error.response?.status === 429 || 
      error.message?.includes('rate limit');

    if (isRateLimit) {
      console.error(`🚨 RATE LIMIT: CoinGecko API rate limit reached for ${id}`);
    } else {
      console.error(`❌ API ERROR: Error fetching price from CoinGecko for ${id}:`, error.message || error);
    }
    
    // Try CoinCap API as a fallback
    try {
      console.log(`🔄 TRYING ALTERNATE API: Fetching from CoinCap for ${id}`);
      const coinCapResponse = await axios.get(`https://api.coincap.io/v2/assets/${id}`, {
        timeout: 5000,
        headers: { 'Accept': 'application/json' }
      });
      
      if (coinCapResponse.status === 200 && coinCapResponse.data?.data?.priceUsd) {
        console.log(`✅ ALTERNATE API SUCCESS: Got price from CoinCap for ${id}: $${coinCapResponse.data.data.priceUsd}`);
        
        const result: CryptoPrice = {
          name: coinCapResponse.data.data.name,
          symbol: coinCapResponse.data.data.symbol,
          price: parseFloat(parseFloat(coinCapResponse.data.data.priceUsd).toFixed(2)),
          currency: "USD",
          source: "coincap-api"
        };
        
        // Update cache
        priceCache[id] = {
          data: result,
          timestamp: Date.now()
        };
        
        return result;
      } else {
        throw new Error("Invalid API response from CoinCap");
      }
    } catch (coinCapError: any) {
      console.error(`❌ ALTERNATE API ERROR: Failed to get data from CoinCap:`, coinCapError.message || coinCapError);
      
      // Try a third API as final fallback
      try {
        console.log(`🔄 TRYING FINAL API: Fetching from CryptoCompare for ${id}`);
        
        // CryptoCompare uses different ID format (symbol)
        const symbolGuess = id.includes('-') ? id.split('-')[0].toUpperCase() : id.toUpperCase();
        const cryptoCompareResponse = await axios.get(`https://min-api.cryptocompare.com/data/price`, {
          params: {
            fsym: symbolGuess,
            tsyms: 'USD'
          },
          timeout: 5000,
          headers: { 'Accept': 'application/json' }
        });
        
        if (cryptoCompareResponse.status === 200 && cryptoCompareResponse.data?.USD) {
          console.log(`✅ FINAL API SUCCESS: Got price from CryptoCompare for ${symbolGuess}: $${cryptoCompareResponse.data.USD}`);
          
          const result: CryptoPrice = {
            name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '),
            symbol: symbolGuess,
            price: parseFloat(parseFloat(cryptoCompareResponse.data.USD).toFixed(2)),
            currency: "USD",
            source: "cryptocompare-api"
          };
          
          // Update cache
          priceCache[id] = {
            data: result,
            timestamp: Date.now()
          };
          
          return result;
        }
      } catch (finalError: any) {
        console.error(`❌ FINAL API ERROR: Failed to get data from CryptoCompare:`, finalError.message || finalError);
      }
    }
  }
  
  return { 
    error: `Could not get price for "${cryptoId}" from any of the APIs. Try one of these: ${POPULAR_CRYPTOS.slice(0, 5).join(', ')}...` 
  };
}

// Add a tool to get the price of a single cryptocurrency
server.tool(
  "getCryptoPrice",
  { cryptoId: z.string().describe("The ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum', 'solana')") },
  async ({ cryptoId }) => {
    const result = await getCryptoPrice(cryptoId);
    
    if ("error" in result) {
      return {
        content: [{ type: "text", text: result.error }],
        isError: true
      };
    }
    
    return {
      content: [{ 
        type: "text", 
        text: `${result.name} (${result.symbol}): $${result.price} ${result.currency} [Source: ${result.source}]` 
      }]
    };
  }
);

// Add a tool to get the prices of multiple cryptocurrencies
server.tool(
  "getMultipleCryptoPrices",
  { 
    cryptoIds: z.string().describe("Comma-separated list of cryptocurrency IDs (e.g., 'bitcoin,ethereum,solana')") 
  },
  async ({ cryptoIds }) => {
    const ids = cryptoIds.split(',').map(id => id.trim());
    const results: string[] = [];
    
    for (const cryptoId of ids) {
      const result = await getCryptoPrice(cryptoId);
      
      if ("error" in result) {
        results.push(`${cryptoId}: ${result.error}`);
      } else {
        results.push(`${result.name} (${result.symbol}): $${result.price} ${result.currency} [Source: ${result.source}]`);
      }
    }
    
    return {
      content: [{ type: "text", text: results.join('\n') }]
    };
  }
);

// Add a resource to get the price of a cryptocurrency
server.resource(
  "cryptoPrice",
  new ResourceTemplate("crypto://{cryptoId}/price", { 
    list: async () => ({
      resources: POPULAR_CRYPTOS.map(crypto => ({ 
        name: `${crypto.charAt(0).toUpperCase() + crypto.slice(1).replace(/-/g, ' ')} Price`, 
        uri: `crypto://${crypto}/price` 
      }))
    })
  }),
  async (uri, params) => {
    const cryptoId = params.cryptoId as string;
    const result = await getCryptoPrice(cryptoId);
    
    if ("error" in result) {
      return {
        contents: [{
          uri: uri.href,
          text: result.error
        }]
      };
    }
    
    return {
      contents: [{
        uri: uri.href,
        text: `${result.name} (${result.symbol}): $${result.price} ${result.currency} [Source: ${result.source}]`
      }]
    };
  }
);

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  console.error("Starting CryptoPriceServer...");
  await server.connect(transport);
  console.error("CryptoPriceServer connected");
}

main().catch(err => {
  console.error("Error running server:", err);
  process.exit(1);
}); 