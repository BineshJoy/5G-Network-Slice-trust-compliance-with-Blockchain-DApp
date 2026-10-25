import hre from "hardhat";

const { ethers } = await hre.network.connect();

const signer = (await ethers.getSigners())[0];

if (!signer) {
  throw new Error("No deployment signer found");
}

console.log("Deploying from:", await signer.getAddress());

const factory = await ethers.getContractFactory(
  "NetworkSliceSecurity",
  signer
);

const contract = await factory.deploy();

console.log("Deployment transaction:", contract.deploymentTransaction()?.hash);

await contract.waitForDeployment();

console.log("Contract address:", await contract.getAddress());
console.log("Deployment successful!");
