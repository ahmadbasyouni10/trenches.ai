import json
from typing import Dict
import httpx
from bs4 import BeautifulSoup

from mcp.server.fastmcp import FastMCP

# Create an MCP server
mcp = FastMCP("CryptoPrice")

async def fetch_crypto_price(crypto_id: str) -> Dict:
    """
    Fetches the price of a cryptocurrency from CoinGecko
    by parsing the JSON-LD data from the page.
    """
    url = f"https://www.coingecko.com/en/coins/{crypto_id}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, follow_redirects=True)
        
        if response.status_code != 200:
            return {"error": f"Failed to fetch data for {crypto_id}, status code: {response.status_code}"}
        
        soup = BeautifulSoup(response.text, 'html.parser')
        json_ld_tags = soup.find_all('script', type='application/ld+json')
        
        for tag in json_ld_tags:
            try:
                data = json.loads(tag.string)
                if data.get("@type") == "ExchangeRateSpecification":
                    return {
                        "name": data.get("name"),
                        "symbol": data.get("currency"),
                        "price": data.get("currentExchangeRate", {}).get("price"),
                        "currency": data.get("currentExchangeRate", {}).get("priceCurrency")
                    }
            except (json.JSONDecodeError, AttributeError):
                continue
        
        return {"error": f"Could not find price data for {crypto_id}"}

@mcp.tool()
async def get_crypto_price(crypto_id: str) -> str:
    """
    Get the current price of a cryptocurrency.
    
    :param crypto_id: The CoinGecko ID of the cryptocurrency (e.g., 'bitcoin', 'ethereum', 'solana')
    :return: The price information as a formatted string
    """
    result = await fetch_crypto_price(crypto_id)
    
    if "error" in result:
        return result["error"]
    
    return f"{result['name']} ({result['symbol']}): {result['price']} {result['currency']}"

@mcp.tool()
async def get_multiple_crypto_prices(crypto_ids: str) -> str:
    """
    Get the current prices of multiple cryptocurrencies.
    
    :param crypto_ids: Comma-separated list of CoinGecko IDs (e.g., 'bitcoin,ethereum,solana')
    :return: The price information as a formatted string
    """
    ids = [id.strip() for id in crypto_ids.split(',')]
    results = []
    
    for crypto_id in ids:
        result = await fetch_crypto_price(crypto_id)
        if "error" in result:
            results.append(f"{crypto_id}: {result['error']}")
        else:
            results.append(f"{result['name']} ({result['symbol']}): {result['price']} {result['currency']}")
    
    return "\n".join(results)

@mcp.resource("crypto://{crypto_id}/price")
async def crypto_price_resource(crypto_id: str) -> str:
    """
    Get the current price of a cryptocurrency as a resource.
    
    :param crypto_id: The CoinGecko ID of the cryptocurrency
    """
    result = await fetch_crypto_price(crypto_id)
    
    if "error" in result:
        return result["error"]
    
    return f"{result['name']} ({result['symbol']}): {result['price']} {result['currency']}"

@mcp.prompt()
def price_check_prompt(crypto_id: str) -> str:
    """Create a prompt to check the price of a cryptocurrency"""
    return f"What is the current price of {crypto_id}?"

# Run the server if this file is executed directly
if __name__ == "__main__":
    mcp.run() 