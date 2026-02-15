/**
 * Fee Estimation API
 * Calculates dynamic transaction fees based on network conditions
 */

const API_BASE = "http://localhost:8080/blockchain";

export interface FeeEstimate {
  base_fee: number;
  amount_fee: number;
  priority_fee: number;
  total_fee: number;
  network_congestion: number;
  estimated_block_time: number;
}

/**
 * Estimate transaction fees
 * @param amount Transaction amount in satoshis
 * @param inputCount Number of UTXOs to spend (default: 1)
 * @returns Fee estimation with breakdown
 */
export async function estimateFees(
  amount: number,
  inputCount: number = 1
): Promise<FeeEstimate> {
  try {
    const response = await fetch(`${API_BASE}/fees/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        input_count: inputCount,
      }),
    });

    if (!response.ok) {
      throw new Error(`Fee estimation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Fee estimation error:", error);
    // Return fallback fee estimate
    const baseFee = 1000;
    const amountFee = Math.max(Math.floor(amount * 0.001), 100);
    const priorityFee = 1000;
    const complexityFee = inputCount * 500;
    const totalFee = baseFee + amountFee + priorityFee + complexityFee;

    return {
      base_fee: baseFee,
      amount_fee: amountFee,
      priority_fee: priorityFee,
      total_fee: totalFee,
      network_congestion: 0.3,
      estimated_block_time: 15,
    };
  }
}

/**
 * Format fee for display
 * @param fee Fee in satoshis
 * @param decimals Number of decimals to show
 * @returns Formatted fee string
 */
export function formatFee(fee: number, decimals: number = 2): string {
  const bolh = fee / 100_000_000;
  return bolh.toFixed(decimals);
}

/**
 * Get fee description based on congestion level
 * @param congestion Network congestion percentage (0-1)
 * @returns Description string
 */
export function getFeeDescription(congestion: number): string {
  if (congestion < 0.2) {
    return "💚 Low network congestion - fast confirmation";
  } else if (congestion < 0.5) {
    return "💛 Moderate network congestion - normal confirmation";
  } else if (congestion < 0.8) {
    return "🟠 High network congestion - slow confirmation";
  } else {
    return "🔴 Very high congestion - consider higher fee";
  }
}
