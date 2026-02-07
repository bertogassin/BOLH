import { ethers, upgrades, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("=".repeat(60));
  console.log("BOLH Token v2 — Upgradeable Deployment");
  console.log("=".repeat(60));
  console.log(`Network:  ${network.name} (chainId: ${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} native`);
  console.log("-".repeat(60));

  if (balance === 0n) {
    throw new Error("Deployer has 0 balance. Fund the wallet first.");
  }

  // For testing/initial deploy, all wallets can be the deployer
  // In production, use separate wallet addresses
  const communityWallet  = deployer.address;
  const teamWallet       = deployer.address;
  const liquidityWallet  = deployer.address;
  const reserveWallet    = deployer.address;
  const marketingWallet  = deployer.address;

  console.log("\nDistribution wallets:");
  console.log(`  Community (40%):  ${communityWallet}`);
  console.log(`  Team (20%):       ${teamWallet}`);
  console.log(`  Liquidity (15%):  ${liquidityWallet}`);
  console.log(`  Reserve (15%):    ${reserveWallet}`);
  console.log(`  Marketing (10%):  ${marketingWallet}`);

  // Deploy as UUPS proxy
  console.log("\nDeploying BOLH proxy...");
  const BOLH = await ethers.getContractFactory("BOLH");
  const bolh = await upgrades.deployProxy(
    BOLH,
    [communityWallet, teamWallet, liquidityWallet, reserveWallet, marketingWallet],
    { kind: "uups" }
  );
  await bolh.waitForDeployment();

  const proxyAddress = await bolh.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  const totalSupply = await bolh.totalSupply();
  const ver = await bolh.version();

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(60));
  console.log(`Proxy:          ${proxyAddress}`);
  console.log(`Implementation: ${implAddress}`);
  console.log(`Version:        ${ver}`);
  console.log(`Total Supply:   ${ethers.formatEther(totalSupply)} BOLH`);
  console.log("");
  console.log("Distribution:");
  console.log(`  Community:    ${ethers.formatEther(await bolh.balanceOf(communityWallet))} BOLH`);
  console.log(`  Team (locked):${ethers.formatEther(await bolh.balanceOf(proxyAddress))} BOLH`);
  console.log(`  Liquidity:    ${ethers.formatEther(await bolh.balanceOf(liquidityWallet))} BOLH`);
  console.log(`  Reserve:      ${ethers.formatEther(await bolh.balanceOf(reserveWallet))} BOLH`);
  console.log(`  Marketing:    ${ethers.formatEther(await bolh.balanceOf(marketingWallet))} BOLH`);
  console.log(`  Anti-whale:   ${await bolh.antiWhaleEnabled()} (max ${(await bolh.maxTransferBps()).toString()} bps)`);
  console.log("=".repeat(60));

  // Save deployment
  const fs = require("fs");
  const dir = "./deployments";
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const info = {
    network: network.name,
    chainId: network.config.chainId,
    proxy: proxyAddress,
    implementation: implAddress,
    version: ver,
    deployer: deployer.address,
    wallets: { communityWallet, teamWallet, liquidityWallet, reserveWallet, marketingWallet },
    totalSupply: ethers.formatEther(totalSupply),
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(`${dir}/${network.name}.json`, JSON.stringify(info, null, 2));
  console.log(`\nSaved to deployments/${network.name}.json`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
