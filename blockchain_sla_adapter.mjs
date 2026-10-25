import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ethers } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// BLOCKCHAIN CONFIGURATION
// ============================================================

const RPC_URL =
    process.env.BLOCKCHAIN_RPC_URL ||
    "http://127.0.0.1:8545";

const CONTRACT_ADDRESS =
    process.env.CONTRACT_ADDRESS ||
    "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0";

// Hardhat local node Account #0 is used through eth_sendTransaction.
// No private key is stored in this file.

// ============================================================
// CONTRACT ABI
// ============================================================

const artifactPath = path.join(
    __dirname,
    "artifacts",
    "contracts",
    "NetworkSliceSecurity.sol",
    "NetworkSliceSecurity.json"
);

if (!fs.existsSync(artifactPath)) {
    throw new Error(
        `Contract artifact not found:\n${artifactPath}`
    );
}

const artifact = JSON.parse(
    fs.readFileSync(artifactPath, "utf8")
);

// ============================================================
// HELPERS
// ============================================================

function numberOrZero(value) {
    const n = Number(value);

    if (!Number.isFinite(n)) {
        return 0;
    }

    return n;
}

// Bandwidth:
// Mbps × 100
//
// Example:
// 105.221 Mbps -> 10522
//
// Latency:
// ms × 1000
//
// Example:
// 5.240 ms -> 5240
//
// Packet loss:
// % × 100
//
// Example:
// 0.50% -> 50

function scaleBandwidth(value) {
    return Math.round(numberOrZero(value) * 100);
}

function scaleLatency(value) {
    return Math.round(numberOrZero(value) * 1000);
}

function scalePacketLoss(value) {
    return Math.round(numberOrZero(value) * 100);
}

// ============================================================
// MAIN
// ============================================================

async function main() {

    // Read JSON from stdin
    let input = "";

    for await (const chunk of process.stdin) {
        input += chunk;
    }

    if (!input.trim()) {
        throw new Error("No JSON input received.");
    }

    const request = JSON.parse(input);

    if (request.action !== "record-sla") {
        throw new Error(
            `Unsupported action: ${request.action}`
        );
    }

    const result = request.result;

    if (!result) {
        throw new Error("Missing SLA result.");
    }

    // ========================================================
    // CONNECT TO LOCAL HARDHAT
    // ========================================================

    const provider =
        new ethers.JsonRpcProvider(RPC_URL);

    const network =
        await provider.getNetwork();

    if (Number(network.chainId) !== 31337) {
        throw new Error(
            `Unexpected blockchain network. ` +
            `Expected Hardhat Local chain 31337, ` +
            `got ${network.chainId}`
        );
    }

    // Hardhat exposes Account #0 through JSON-RPC.
    const signer = await provider.getSigner(0);

    const signerAddress =
        await signer.getAddress();

    const contract =
        new ethers.Contract(
            CONTRACT_ADDRESS,
            artifact.abi,
            signer
        );

    // ========================================================
    // EXTRACT SLA VALUES
    // ========================================================

    const sliceId =
        String(result.slice || "");

    if (!sliceId) {
        throw new Error("SLA result does not contain slice ID.");
    }

    const bandwidth =
        result.bandwidth || {};

    const latency =
        result.latency || {};

    const packetLoss =
        result.packet_loss || {};

    const requiredBandwidth =
        numberOrZero(
            bandwidth.configured_mbps
        );

    const measuredBandwidth =
        numberOrZero(
            bandwidth.measured_mbps
        );

    const measuredLatency =
        numberOrZero(
            latency.measured_average_ms
        );

    const measuredPacketLoss =
        numberOrZero(
            packetLoss.measured_percent
        );

    const bandwidthCompliant =
        Boolean(bandwidth.compliant);

    const latencyCompliant =
        Boolean(latency.compliant);

    const packetLossCompliant =
        Boolean(packetLoss.compliant);

    // ========================================================
    // SCALE FOR SMART CONTRACT
    // ========================================================

    const requiredBandwidthOnChain =
        Math.round(requiredBandwidth);

    const measuredBandwidthOnChain =
        scaleBandwidth(measuredBandwidth);

    const measuredLatencyOnChain =
        scaleLatency(measuredLatency);

    const measuredPacketLossOnChain =
        scalePacketLoss(measuredPacketLoss);

    // ========================================================
    // RECORD SLA MEASUREMENT
    // ========================================================

    console.log(
        `Recording ${sliceId} SLA measurement...`
    );

    const measurementTx =
        await contract.recordSLAMeasurement(
            sliceId,
            requiredBandwidthOnChain,
            measuredBandwidthOnChain,
            measuredLatencyOnChain,
            measuredPacketLossOnChain,
            bandwidthCompliant,
            latencyCompliant,
            packetLossCompliant
        );

    await measurementTx.wait();

    // ========================================================
    // RECORD VIOLATIONS
    // ========================================================

    const violationTransactions = [];

    if (!bandwidthCompliant) {

        const description =
            `Measured bandwidth was ${measuredBandwidth.toFixed(3)} Mbps ` +
            `which is below the minimum SLA threshold of ` +
            `${numberOrZero(bandwidth.minimum_mbps).toFixed(3)} Mbps.`;

        console.log(
            "Recording BANDWIDTH violation..."
        );

        const tx =
            await contract.recordViolation(
                sliceId,
                "BANDWIDTH",
                description
            );

        await tx.wait();

        violationTransactions.push({
            type: "BANDWIDTH",
            transaction_hash: tx.hash,
            description
        });
    }

    if (!latencyCompliant) {

        const description =
            `Average latency was ${measuredLatency.toFixed(3)} ms ` +
            `which exceeded the maximum SLA threshold of ` +
            `${numberOrZero(latency.maximum_average_ms).toFixed(3)} ms.`;

        console.log(
            "Recording LATENCY violation..."
        );

        const tx =
            await contract.recordViolation(
                sliceId,
                "LATENCY",
                description
            );

        await tx.wait();

        violationTransactions.push({
            type: "LATENCY",
            transaction_hash: tx.hash,
            description
        });
    }

    if (!packetLossCompliant) {

        const description =
            `Packet loss was ${measuredPacketLoss.toFixed(2)}% ` +
            `which exceeded the maximum SLA threshold of ` +
            `${numberOrZero(packetLoss.maximum_percent).toFixed(2)}%.`;

        console.log(
            "Recording PACKET_LOSS violation..."
        );

        const tx =
            await contract.recordViolation(
                sliceId,
                "PACKET_LOSS",
                description
            );

        await tx.wait();

        violationTransactions.push({
            type: "PACKET_LOSS",
            transaction_hash: tx.hash,
            description
        });
    }

    // ========================================================
    // RETURN BLOCKCHAIN RESULT
    // ========================================================

    const response = {

        success: true,

        network: {
            name: "Hardhat Local",
            chain_id: Number(network.chainId),
            rpc_url: RPC_URL
        },

        contract_address:
            CONTRACT_ADDRESS,

        recorded_by:
            signerAddress,

        slice:
            sliceId,

        measurement: {

            transaction_hash:
                measurementTx.hash,

            required_bandwidth_mbps:
                requiredBandwidth,

            measured_bandwidth_mbps:
                measuredBandwidth,

            measured_bandwidth_on_chain:
                measuredBandwidthOnChain,

            measured_latency_ms:
                measuredLatency,

            measured_latency_on_chain:
                measuredLatencyOnChain,

            measured_packet_loss_percent:
                measuredPacketLoss,

            measured_packet_loss_on_chain:
                measuredPacketLossOnChain,

            bandwidth_compliant:
                bandwidthCompliant,

            latency_compliant:
                latencyCompliant,

            packet_loss_compliant:
                packetLossCompliant,

            overall_compliant:
                Boolean(result.overall_compliant)
        },

        violations:
            violationTransactions
    };

    console.log(
        JSON.stringify(response, null, 2)
    );
}

main().catch((error) => {

    console.error(
        JSON.stringify(
            {
                success: false,
                error: error.message || String(error)
            },
            null,
            2
        )
    );

    process.exit(1);
});
