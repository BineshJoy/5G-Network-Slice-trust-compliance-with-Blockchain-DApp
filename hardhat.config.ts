
import { defineConfig, configVariable } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";

export default defineConfig({
  plugins: [hardhatEthers, hardhatKeystore],

  solidity: {
    version: "0.8.34",
  },

  networks: {
    sepolia: {
      type: "http",
      chainType: "l1",
      chainId: 11155111,
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});

