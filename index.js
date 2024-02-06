const { ethers } = require("ethers");

// QuickSwap Router Contract Address (example, check for the current one)
const quickSwapRouterAddress = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

// Watched Address and IXT Token Address
const watchedAddresses = ["0x...", "0x...", "0x..."]; // Add your addresses here
const ixtAddress = "0x..."; // IXT token address on Polygon

// QuickSwap Router Contract ABI (simplified, get the full ABI from the docs or Polygonscan)
const quickSwapRouterABI = [
  // Add the full ABI here
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline)",
  // Include other relevant methods
];
const provider = new ethers.providers.JsonRpcProvider(
  process.env.POLYGON_RPC_URL
);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const routerContract = new ethers.Contract(
  quickSwapRouterAddress,
  quickSwapRouterABI,
  signer
);

// Function to Decode a Transaction and Check for Watched Addresses
async function decodeTransaction(txHash) {
  const tx = await provider.getTransaction(txHash);
  // Convert the list of watched addresses to lowercase for case-insensitive comparison
  const watchedAddressesLower = watchedAddresses.map((address) =>
    address.toLowerCase()
  );
  // Check if the transaction is from one of the watched addresses and to the QuickSwap Router
  if (
    watchedAddressesLower.includes(tx.from.toLowerCase()) &&
    tx.to.toLowerCase() === quickSwapRouterAddress.toLowerCase()
  ) {
    try {
      const decodedInput = routerContract.interface.parseTransaction({
        data: tx.data,
      });
      console.log(decodedInput);

      // Further checks to see if it's a swapExactTokensForTokens transaction for IXT
      if (decodedInput.name === "swapExactTokensForTokens") {
        const path = decodedInput.args.path;
        if (path.includes(ixtAddress.toLowerCase())) {
          console.log(
            "Transaction is a buy order for IXT on QuickSwap from one of the watched addresses."
          );
          return true; // Indicates a matching transaction was found
        }
      }
    } catch (error) {
      console.error("Error decoding transaction:", error);
    }
  }
  return false; // No matching transaction found
}

// Function to Buy IXT with Random MATIC Amount
async function buyIXTWithMATIC(originalTx) {
  // Generate a random amount of MATIC between 200 and 500
  const maticAmount = ethers.utils.parseEther(
    `${Math.random() * (500 - 200) + 200}`
  );

  // Setup the swap parameters
  const amountOutMin = 0; // Set to 0 for simplicity, consider using a price oracle or slippage tolerance
  const path = [ethers.constants.AddressZero, ixtAddress]; // AddressZero represents MATIC
  const to = signer.address; // The address receiving the IXT
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current time

  // Execute the swap
  try {
    const tx = await routerContract.swapExactETHForTokens(
      amountOutMin,
      path,
      to,
      deadline,
      { value: maticAmount, gasPrice: originalTx.gasPrice * 2 }
    );
    console.log(`Buy transaction hash: ${tx.hash}`);
    return tx; // Return the transaction object for further processing
  } catch (error) {
    console.error(`Error executing swap: ${error.message}`);
  }
}

async function sellAllIXTForMATIC() {
  const ixtTokenABI = [
    // Minimal ABI for balanceOf and approve
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
  ];
  const ixtTokenContract = new ethers.Contract(ixtAddress, ixtTokenABI, signer);

  // 1. Determine the IXT Token Balance
  const ixtBalance = await ixtTokenContract.balanceOf(signer.address);
  console.log(`IXT Balance: ${ethers.utils.formatEther(ixtBalance)} IXT`);

  // 2. Approve the Router to Spend Your IXT
  const approveTx = await ixtTokenContract.approve(
    quickSwapRouterAddress,
    ixtBalance
  );
  await approveTx.wait();
  console.log(`Approved QuickSwap Router to spend IXT`);

  // 3. Execute the Swap from IXT to MATIC
  const path = [ixtAddress, ethers.constants.AddressZero]; // Path from IXT to MATIC
  const amountOutMin = 0; // Set to 0 for simplicity, consider using a price oracle or slippage tolerance
  const to = signer.address; // The address receiving MATIC
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current time

  try {
    const swapTx = await routerContract.swapExactTokensForETH(
      ixtBalance,
      amountOutMin,
      path,
      to,
      deadline
    );
    console.log(`Swap transaction hash: ${swapTx.hash}`);
    const receipt = await swapTx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
  } catch (error) {
    console.error(`Error executing swap: ${error.message}`);
  }
}

async function handleTransactionSequence(originalTx) {
  try {
    // Assuming buyIXTWithMATIC returns the transaction object
    const buyTransaction = await buyIXTWithMATIC(originalTx);

    // Wait for the buy transaction to be confirmed
    const receipt = await buyTransaction.wait();
    console.log(`Buy transaction confirmed in block ${receipt.blockNumber}`);

    const originalReceipt = await provider.getTransactionReceipt(
      originalTx.hash
    );
    console.log(
      `Original transaction confirmed in block ${originalReceipt.blockNumber}`
    );

    // Once the buy transaction is confirmed, proceed to sell
    await sellAllIXTForMATIC();
  } catch (error) {
    console.error(`Error during transaction sequence: ${error.message}`);
  }
}

// Monitor the Mempool for Transactions
provider.on("block", async (blockNumber) => {
  console.log(`New block: ${blockNumber}`);
  const block = await provider.getBlockWithTransactions(blockNumber);

  for (const tx of block.transactions) {
    if (tx.to && tx.to.toLowerCase() === quickSwapRouterAddress.toLowerCase()) {
      // Decode the transaction to see if it matches the criteria
      const isTargetedTransaction = await decodeTransaction(tx.hash);

      // If it matches, execute a buy order for IXT
      if (isTargetedTransaction) {
        console.log("Matching transaction found, attempting to buy IXT...");
        await handleTransactionSequence(tx);
      }
    }
  }
});
