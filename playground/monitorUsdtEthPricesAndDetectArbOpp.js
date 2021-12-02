const ethers = require('ethers');  

const provider = new ethers.providers.JsonRpcProvider();
const signer = provider.getSigner();

// exchange addresses
// @TODO: how to gete all pairs and then fetch all addresses for the list of pairs ?
const uniswapUsdtEthExchange = "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc";
const sushiswapUsdtEthExchange = "0x397ff1542f962076d0bfe58ea045ffa2d347aca0";

// ABI for both Uniswap and SushiSwap
const xswapAbi = [
  "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
];

// swap fees are 3% on both DEXs
const SWAP_FEE = 0.3/100;

// decimals of each ERC20 contract
// @TODO: how to fetch ?
const decimalsUSDT = 6;
const decimalsETH = 18;

// Parse swap arguments to find out how much of each token was swapped in/out
function getAmountsFromSwapArgs(swapArgs) {
  const { amount0In, amount0Out, amount1In, amount1Out } = swapArgs;
  // 1. The eq method is for objects created
  //    from ethers.js BigNumber helper
  // 2. Note, this code only handles simple one-to-one token swaps.
  //    (It's also possible to swap both token0 and token1 for token0 and token1)
  let token0AmountBigDecimal = amount0In;
  if (token0AmountBigDecimal.eq(0)) {
    token0AmountBigDecimal = amount0Out;
  }

  let token1AmountBigDecimal = amount1In;
  if (token1AmountBigDecimal.eq(0)) {
    token1AmountBigDecimal = amount1Out;
  }

  return { token0AmountBigDecimal, token1AmountBigDecimal };
}

// Receive swap event and convert it to price and volume
function convertSwapEventToPriceAndVolume({ swapArgs, token0Decimals, token1Decimals }) {
  const {
    token0AmountBigDecimal,
    token1AmountBigDecimal,
  } = getAmountsFromSwapArgs(swapArgs);

  const token0AmountFloat = parseFloat(
    ethers.utils.formatUnits(token0AmountBigDecimal, token0Decimals)
  );
  const token1AmounFloat = parseFloat(
    ethers.utils.formatUnits(token1AmountBigDecimal, token1Decimals)
  );

  if (token1AmounFloat > 0) {
    const priceOfToken0InTermsOfToken1 = token0AmountFloat / token1AmounFloat;
    return { price: priceOfToken0InTermsOfToken1, volume: token0AmountFloat };
  }

  return null;
}

// Estimate profit from 2 prices
function estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice) {
  const priceDiff = Math.abs(sushiswapPrice - uniswapPrice);
  const ratio = priceDiff / Math.max(sushiswapPrice, uniswapPrice);

  // multiply by 2 because we trade 2 times
  // (once on Uniswap and once on SushiSwap)
  const fees = SWAP_FEE * 2;

  return ratio - fees;
}

// create both contracts
const uniswapContract = new ethers.Contract(
  uniswapUsdtEthExchange,
  xswapAbi,
  provider
);
const sushiswapContract = new ethers.Contract(
  sushiswapUsdtEthExchange,
  xswapAbi,
  provider
);

// create swap filters 
const uniswapFilter = uniswapContract.filters.Swap();
const sushiswapFilter = sushiswapContract.filters.Swap();

// price on each DEX
uniswapPrice = 0;
sushiswapPrice = 0;

console.log("Starting to monitor UsdtEth swaps on Uniswap and Sushiswap")

uniswapContract.on(uniswapFilter, (from, a0in, a0out, a1in, a1out, to, event) => {
  const { price, volume } = convertSwapEventToPriceAndVolume({
    swapArgs: event.args,
    token0Decimals: decimalsUSDT,
    token1Decimals: decimalsETH,
  });
  uniswapPrice = price;
  console.log("Uniswap", { price, volume });
  console.log("Estimated profit", estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice))
});

sushiswapContract.on(sushiswapFilter, (from, a0in, a0out, a1in, a1out, to, event) => {
  const { price, volume } = convertSwapEventToPriceAndVolume({
    swapArgs: event.args,
    token0Decimals: decimalsUSDT,
    token1Decimals: decimalsETH,
  });
  sushiswapPrice = price;
  console.log("Sushiswap", { price, volume });
  console.log("Estimated profit", estimateProfitAfterTradingFees(uniswapPrice, sushiswapPrice))
});


