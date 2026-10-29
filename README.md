# Network Slice Security DApp

**A blockchain-based application for monitoring and recording Live 5G network slice Service Level Agreement (SLA) measurements and violations. The project combines a Solidity smart contract, an Ethereum test network, a browser-based dashboard, and Python-based monitoring components.**

**We have a total of 5 Ubuntu VMs in VMware Workstation. 4 out of 5 VMs are for simulating the complex Open5G Network Slicing setup, and 1 VM is for the Blockchain layer.** 

**1.	VM1-5G Core
2.	VM2-UE & RAN Simulator
3.	VM3-UPF01 - User Plane function 1(5G Slice 1)
4.	VM4-UPF02 - User Plane function 2(5G Slice 2)
5.	VM5-Blockchain Layer (Ethereum-Sepolia)**


## Features

- Register 5G network slice configurations on the blockchain from Open5G VMs.
- Record Live bandwidth, latency, and packet-loss measurements for different 5G Network slices configured over 5G Network simulator.
- Record SLA violations for traceability and auditing.
- Interact with the smart contract through a browser dashboard.
- Connect a wallet using MetaMask and ethers.js.
- Demonstrate blockchain transactions on Ethereum Sepolia.
- Run local SLA integration and testing using Hardhat.

## Technology Stack

- Solidity 0.8.34
- Hardhat 3
- Ethereum Sepolia Testnet
- ethers.js
- MetaMask
- HTML, CSS and JavaScript
- Python and Node.js

## Deployed Smart Contract

| Property | Value |
|---|---|
| Network | Ethereum Sepolia Testnet |
| Chain ID | 11155111 |
| Contract address | `0xcA27F892E14b39Df203faD0d5549181E5F351E70` |

- [View the deployed contract on Sepolia Etherscan](https://sepolia.etherscan.io/address/0xcA27F892E14b39Df203faD0d5549181E5F351E70)
- [View an example Sepolia transaction](https://sepolia.etherscan.io/tx/0x64542df5bbf7963b21f3dac1bab84cfa4fcb9882707bd801a4af85617b8adad9)

The Sepolia dashboard demonstration records sample SLA data. The current live SLA adapter uses a separate local Hardhat blockchain. These are separate transaction paths.

## Prerequisites

- Node.js and npm
- Git
- Python 3
- MetaMask browser extension
- Sepolia test ETH for Sepolia transactions

## Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/network-slice-security-dapp.git
cd network-slice-security-dapp
```

Install dependencies:

```bash
npm install
```

## Compile the Smart Contract

```bash
npx hardhat compile
```

## Deploy the Smart Contract to Sepolia

The project uses `scripts/deploy-sepolia.ts` and the Sepolia configuration in `hardhat.config.ts`.

Configure the Sepolia RPC URL and deployment private key using the project's Hardhat keystore. Never commit private keys, recovery phrases, or credentials to GitHub.

Deploy the contract:

```bash
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

A new deployment creates a new contract address. The address documented above is the existing deployment.

## Run the Frontend

From the project root:

```bash
python3 -m http.server 8080 --directory frontend
```

Open the dashboard in your browser:

```text
http://127.0.0.1:8080
```

For Sepolia interaction:

1. Open MetaMask and select Ethereum Sepolia.
2. Connect your wallet to the dashboard.
3. Confirm that the displayed network and contract address are correct.
4. Use the Sepolia demo control and approve the transaction in MetaMask.

If accessing the frontend from another machine, use the Ubuntu VM's reachable IP address and ensure the VM network permits the connection.

## Run Local Hardhat SLA Testing

Open a separate terminal:

```bash
npx hardhat node
```

Keep the local node running while using the existing SLA adapter. It expects the local JSON-RPC endpoint `http://127.0.0.1:8545` and chain ID `31337`.

The local Hardhat contract and the Sepolia contract are separate deployments. Local measurements are not automatically recorded on Sepolia.

## Project Structure

```text
network-slice-security-dapp/
├── contracts/
│   └── NetworkSliceSecurity.sol
├── scripts/
│   ├── deploy-sepolia.ts
│   ├── deploy.ts
│   └── check-sepolia.ts
├── frontend/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── contract-abi.json
│   └── lib/
├── docs/
│   └── screenshots/
│       └── dashboard.png
├── 5g_api.py
├── 5g_monitor.py
├── 5g_sla_test.py
├── blockchain_sla_adapter.mjs
├── hardhat.config.ts
├── package.json
├── package-lock.json
└── README.md
```

## Dashboard Screenshot

![Network Slice Security DApp dashboard](docs/screenshots/)

## Security Notes

- Never commit wallet private keys, seed phrases, or secret RPC credentials.
- Keep local environment files out of version control.
- Sepolia is a test network; use test ETH only.
- The sample Sepolia measurements are demonstration data, not proof of live network measurements.

## License

Add a license if required by your submission guidelines.
