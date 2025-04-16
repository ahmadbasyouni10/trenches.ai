import axios from 'axios';

// Types for wallet analysis
export interface WalletStats {
  totalTrades: number;
  profitableTrades: number;
  totalProfitLoss: number;
  averageTradeSize: number;
  largestTrade: number;
  largestSOLTrade: number;
  successRate: number;
  tradeHistory: TradeInfo[];
}

export interface TradeInfo {
  timestamp: number;
  type: string;
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: number;
  amountOut?: number;
  profitLoss?: number;
  signature: string;
  source?: string;
}

export class WalletAnalyzer {
  private heliusApiKey: string;
  private requestTimeout: number = 30000; // 30 seconds timeout

  constructor(heliusApiKey: string) {
    this.heliusApiKey = heliusApiKey;
  }

  async analyzeWallet(walletAddress: string): Promise<WalletStats> {
    try {
      console.log(`Fetching transactions for ${walletAddress}`);
      
      // Using the correct endpoint format from the Helius API docs
      const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions/?api-key=${this.heliusApiKey}`;
      
      const response = await axios.get(url, { 
        timeout: this.requestTimeout,
        params: {
          limit: 50 // Get more transactions to find swaps
        }
      });
      
      console.log(`Received ${response.data?.length || 0} transactions`);
      const transactions = response.data || [];

      // Initialize stats
      const stats: WalletStats = {
        totalTrades: 0,
        profitableTrades: 0,
        totalProfitLoss: 0,
        averageTradeSize: 0,
        largestTrade: 0,
        largestSOLTrade: 0,
        successRate: 0,
        tradeHistory: []
      };

      // Process each transaction
      for (const tx of transactions) {
        // Only process SWAP transactions
        if (tx.type === 'SWAP') {
          console.log(`Processing SWAP transaction: ${tx.signature?.substring(0, 10)}...`);
          
          const tradeInfo = this.extractSwapInfo(tx, walletAddress);
          if (tradeInfo) {
            stats.tradeHistory.push(tradeInfo);
            stats.totalTrades++;
            
            if (tradeInfo.profitLoss && tradeInfo.profitLoss > 0) {
              stats.profitableTrades++;
              stats.totalProfitLoss += tradeInfo.profitLoss;
            }

            // For largest trade, only consider SOL or stablecoin trades for accuracy
            if (tradeInfo.tokenIn === 'So11111111111111111111111111111111111111112' && tradeInfo.amountIn) {
              // This is a SOL trade
              if (tradeInfo.amountIn > stats.largestSOLTrade) {
                stats.largestSOLTrade = tradeInfo.amountIn;
              }
            }
            
            // Track highest amount for any token (just for reference)
            if (tradeInfo.amountIn && tradeInfo.amountIn > stats.largestTrade) {
              stats.largestTrade = tradeInfo.amountIn;
            }
          }
        }
      }

      console.log(`Analysis complete: Found ${stats.totalTrades} swap trades`);
      
      // Calculate final stats
      if (stats.totalTrades > 0) {
        stats.successRate = (stats.profitableTrades / stats.totalTrades) * 100;
        stats.averageTradeSize = stats.totalProfitLoss / stats.totalTrades;
      }

      return stats;
    } catch (error) {
      console.error('Error analyzing wallet:', error);
      throw new Error('Failed to analyze wallet transactions: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  private extractSwapInfo(tx: any, walletAddress: string): TradeInfo | null {
    try {
      // Basic trade info
      const tradeInfo: TradeInfo = {
        timestamp: tx.timestamp,
        type: 'SWAP',
        signature: tx.signature,
        source: tx.source || 'Unknown'
      };

      // Extract token transfer information
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        // Find token transfers where the wallet is sending tokens (selling)
        const tokensSent = tx.tokenTransfers.filter((transfer: any) => 
          transfer.fromUserAccount === walletAddress
        );
        
        // Find token transfers where the wallet is receiving tokens (buying)
        const tokensReceived = tx.tokenTransfers.filter((transfer: any) => 
          transfer.toUserAccount === walletAddress
        );
        
        // Get the tokens sent by the wallet (what was sold)
        if (tokensSent.length > 0) {
          const soldTransfer = tokensSent[0];
          tradeInfo.tokenIn = soldTransfer.mint;
          
          // Handle amount correctly with proper decimal places
          let amountIn = 0;
          
          if (soldTransfer.rawTokenAmount) {
            // Use rawTokenAmount when available
            const decimals = soldTransfer.rawTokenAmount.decimals || 6;
            const rawAmount = soldTransfer.rawTokenAmount.tokenAmount || "0";
            amountIn = parseFloat(rawAmount) / Math.pow(10, decimals);
          } else if (typeof soldTransfer.tokenAmount === 'number') {
            // Use tokenAmount directly if it's a number
            amountIn = soldTransfer.tokenAmount;
          } else if (typeof soldTransfer.tokenAmount === 'string') {
            // Parse string as a float if needed
            amountIn = parseFloat(soldTransfer.tokenAmount);
          }
          
          tradeInfo.amountIn = amountIn;          
          console.log(`Token sold: ${soldTransfer.mint}, Amount: ${tradeInfo.amountIn}`);
        }
        
        // Get the tokens received by the wallet (what was bought)
        if (tokensReceived.length > 0) {
          const boughtTransfer = tokensReceived[0];
          tradeInfo.tokenOut = boughtTransfer.mint;
          
          // Handle amount correctly with proper decimal places
          const decimals = boughtTransfer.rawTokenAmount?.decimals || 6; // Default to 6 if not provided
          const rawAmount = boughtTransfer.rawTokenAmount?.tokenAmount || boughtTransfer.tokenAmount.toString().replace('.', '');
          
          // Convert with proper decimals
          tradeInfo.amountOut = parseFloat(rawAmount) / Math.pow(10, decimals);
          
          // Sanity check - if amount is unreasonably large, it might be a decimal error
          if (tradeInfo.amountOut > 1000000 && boughtTransfer.mint !== 'GiwsvnWCAGs37hQAcuCC3GB4PxuUtMe7r4jc2E9Gpump') {
            // This is likely a very large number with wrong decimals - cap it
            tradeInfo.amountOut = tradeInfo.amountOut / 1000000;
          }
          
          console.log(`Token bought: ${boughtTransfer.mint}, Amount: ${tradeInfo.amountOut}`);
        }
        
        // For P/L calculation, we'll use a different approach
        // Instead of trying to calculate exact profit/loss, we'll look at the price impact
        // If wallet address's balance change is positive, consider it profitable
        if (tx.accountData) {
          const walletAccountData = tx.accountData.find((data: any) => 
            data.account === walletAddress
          );
          
          if (walletAccountData) {
            // If the native balance increased, consider this profitable
            if (walletAccountData.nativeBalanceChange > 0) {
              // Convert lamports to SOL
              tradeInfo.profitLoss = walletAccountData.nativeBalanceChange / 1e9;
              console.log(`Trade was profitable: ${tradeInfo.profitLoss} SOL balance increase`);
            } else if (tradeInfo.tokenOut === 'So11111111111111111111111111111111111111112' && 
                      tradeInfo.tokenIn !== 'So11111111111111111111111111111111111111112') {
              // Swapping to SOL
              tradeInfo.profitLoss = 0.001; // Assume small profit
            } else {
              // Set a small negative value to indicate not profitable
              tradeInfo.profitLoss = -0.001;
            }
          }
        }
        
        return tradeInfo;
      }
      
      // If we couldn't extract token transfer data, check if there's any native SOL transfers
      if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        const solReceived = tx.nativeTransfers.filter((transfer: any) => 
          transfer.toUserAccount === walletAddress
        );
        
        const solSent = tx.nativeTransfers.filter((transfer: any) => 
          transfer.fromUserAccount === walletAddress
        );
        
        if (solSent.length > 0 && solReceived.length > 0) {
          // This is likely a SOL swap
          tradeInfo.tokenIn = 'SOL';
          tradeInfo.tokenOut = 'SOL';
          tradeInfo.amountIn = solSent.reduce((sum: number, transfer: any) => sum + transfer.amount, 0) / 1e9;
          tradeInfo.amountOut = solReceived.reduce((sum: number, transfer: any) => sum + transfer.amount, 0) / 1e9;
          return tradeInfo;
        }
      }
      
      // We couldn't extract transaction details
      return null;
    } catch (error) {
      console.error('Error extracting trade info:', error);
      return null;
    }
  }

  async generateEndOfDayReport(walletAddress: string): Promise<string> {
    try {
      const stats = await this.analyzeWallet(walletAddress);
      
      // For tokens, try to map common addresses to names
      const tokenMap: {[key: string]: string} = {
        'So11111111111111111111111111111111111111112': 'SOL',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
        'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT'
      };
      
      const formatToken = (mint?: string) => {
        if (!mint) return 'Unknown';
        return tokenMap[mint] || mint.slice(0, 4) + '...' + mint.slice(-4);
      };
      
      return `
=== Solana Wallet Trading Report ===
Wallet: ${walletAddress}
Total Swaps: ${stats.totalTrades}
Profitable Trades: ${stats.profitableTrades}
Success Rate: ${stats.successRate.toFixed(2)}%
Total P/L: ${stats.totalProfitLoss.toFixed(4)} SOL
Average Trade Size: ${stats.averageTradeSize.toFixed(4)} SOL
Largest SOL Trade: ${stats.largestSOLTrade.toFixed(4)} SOL

Recent Trades:
${stats.tradeHistory.slice(0, 5).map(trade => 
  `${new Date(trade.timestamp * 1000).toLocaleString()}
   ${formatToken(trade.tokenIn)} → ${formatToken(trade.tokenOut)}
   Amount: ${trade.amountIn?.toFixed(6) || 'Unknown'} → ${trade.amountOut?.toFixed(6) || 'Unknown'}
   Source: ${trade.source || 'Unknown'}
  `).join('\n')}
`;
    } catch (error) {
      console.error('Error generating report:', error);
      return `Error generating report: ${error}. Try checking only the last few transactions.`;
    }
  }
} 