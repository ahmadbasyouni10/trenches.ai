import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";
import { JSDOM } from "jsdom";
// Create an MCP server
const server = new McpServer({
    name: "CryptoPriceServer",
    version: "1.0.0"
});
/**
 * Fetches the price of a cryptocurrency from CoinGecko
 * by parsing the JSON-LD data from the page.
 */
async function fetchCryptoPrice(cryptoId) {
    try {
        const url = `https://www.coingecko.com/en/coins/${cryptoId}`;
        const response = await axios.get(url);
        if (response.status !== 200) {
            return {
                error: `Failed to fetch data for ${cryptoId}, status code: ${response.status}`
            };
        }
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        // Find all JSON-LD script tags
        const scriptElements = document.querySelectorAll('script[type="application/ld+json"]');
        for (let i = 0; i < scriptElements.length; i++) {
            try {
                const scriptContent = scriptElements[i].textContent;
                if (!scriptContent)
                    continue;
                const data = JSON.parse(scriptContent);
                if (data["@type"] === "ExchangeRateSpecification") {
                    return {
                        name: data.name,
                        symbol: data.currency,
                        price: data.currentExchangeRate?.price || 0,
                        currency: data.currentExchangeRate?.priceCurrency || "USD"
                    };
                }
            }
            catch (err) {
                console.error("Error parsing script tag:", err);
                continue;
            }
        }
        return { error: `Could not find price data for ${cryptoId}` };
    }
    catch (error) {
        console.error("Error fetching crypto price:", error);
        return { error: `Failed to fetch data for ${cryptoId}: ${error}` };
    }
}
// Add a tool to get the price of a single cryptocurrency
server.tool("getCryptoPrice", { cryptoId: z.string().describe("The CoinGecko ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum', 'solana')") }, async ({ cryptoId }) => {
    const result = await fetchCryptoPrice(cryptoId);
    if ("error" in result) {
        return {
            content: [{ type: "text", text: result.error }],
            isError: true
        };
    }
    return {
        content: [{
                type: "text",
                text: `${result.name} (${result.symbol}): ${result.price} ${result.currency}`
            }]
    };
});
// Add a tool to get the prices of multiple cryptocurrencies
server.tool("getMultipleCryptoPrices", {
    cryptoIds: z.string().describe("Comma-separated list of CoinGecko IDs (e.g., 'bitcoin,ethereum,solana')")
}, async ({ cryptoIds }) => {
    const ids = cryptoIds.split(',').map(id => id.trim());
    const results = [];
    for (const cryptoId of ids) {
        const result = await fetchCryptoPrice(cryptoId);
        if ("error" in result) {
            results.push(`${cryptoId}: ${result.error}`);
        }
        else {
            results.push(`${result.name} (${result.symbol}): ${result.price} ${result.currency}`);
        }
    }
    return {
        content: [{ type: "text", text: results.join('\n') }]
    };
});
// Add a resource to get the price of a cryptocurrency
server.resource("cryptoPrice", new ResourceTemplate("crypto://{cryptoId}/price", { list: undefined }), async (uri, params) => {
    const cryptoId = params.cryptoId;
    const result = await fetchCryptoPrice(cryptoId);
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
                text: `${result.name} (${result.symbol}): ${result.price} ${result.currency}`
            }]
    };
});
// Add a prompt for checking crypto prices
server.prompt("checkCryptoPrice", { cryptoId: z.string() }, ({ cryptoId }) => ({
    messages: [{
            role: "user",
            content: {
                type: "text",
                text: `What is the current price of ${cryptoId}?`
            }
        }]
}));
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
//# sourceMappingURL=index.js.map