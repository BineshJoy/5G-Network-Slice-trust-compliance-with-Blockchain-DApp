import hre from "hardhat";

const { ethers } = await hre.network.connect();

const network = await ethers.provider.getNetwork();
console.log("Chain ID:", network.chainId.toString());

const signers = await ethers.getSigners();
const signer = signers[0];

if (!signer) {
  throw new Error("No signer found. Check the Sepolia account configuration.");
}

const address = await signer.getAddress();
console.log("Wallet address:", address);

const balance = await ethers.provider.getBalance(address);
console.log("Sepolia ETH balance:", ethers.formatEther(balance));
