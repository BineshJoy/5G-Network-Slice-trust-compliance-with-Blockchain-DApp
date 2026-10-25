import { network } from "hardhat";

const { ethers } = await network.create();

const contract = await ethers.deployContract("NetworkSliceSecurity");

await contract.waitForDeployment();

console.log("NetworkSliceSecurity deployed to:");
console.log(await contract.getAddress());
