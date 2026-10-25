import hre from "hardhat";

const { ethers } = await hre.network.connect();

async function main() {

  console.log();
  console.log("==============================================");
  console.log(" NetworkSliceSecurity - Contract Test");
  console.log(" Hardhat 3 Compatible");
  console.log("==============================================");
  console.log();


  // ==========================================================
  // SCALE FACTORS
  // ==========================================================

  const BANDWIDTH_SCALE = 100;
  const LATENCY_SCALE = 1000;
  const PACKET_LOSS_SCALE = 100;

  console.log("Measurement scale factors:");
  console.log("  Bandwidth   : x100");
  console.log("  Latency     : x1000");
  console.log("  Packet loss : x100");
  console.log();


  // ==========================================================
  // 1. DEPLOY CONTRACT
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("1. Deploying NetworkSliceSecurity");
  console.log("----------------------------------------------");

  const contract = await ethers.deployContract(
    "NetworkSliceSecurity"
  );

  await contract.waitForDeployment();

  const contractAddress =
    await contract.getAddress();

  console.log(
    "Contract address:",
    contractAddress
  );

  console.log();


  // ==========================================================
  // 2. REGISTER SLICE-1 CONFIGURATION
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("2. Registering Slice-1 configuration");
  console.log("----------------------------------------------");

  const configTx =
    await contract.registerConfiguration(
      "SLICE-1",
      1,
      "010203",
      "internet",
      "SMF-01",
      "UPF-01",
      "SHA256-CONFIG-HASH-001"
    );

  await configTx.wait();

  console.log(
    "Configuration registered successfully."
  );

  console.log();


  // ==========================================================
  // 3. READ CONFIGURATION
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("3. Reading Slice-1 configuration");
  console.log("----------------------------------------------");

  const config =
    await contract.getConfiguration(
      "SLICE-1"
    );

  console.log(
    "Slice ID      :",
    config[0]
  );

  console.log(
    "SST           :",
    config[1].toString()
  );

  console.log(
    "SD            :",
    config[2]
  );

  console.log(
    "DNN           :",
    config[3]
  );

  console.log(
    "SMF           :",
    config[4]
  );

  console.log(
    "UPF           :",
    config[5]
  );

  console.log(
    "Config Hash   :",
    config[6]
  );

  console.log(
    "Timestamp     :",
    config[7].toString()
  );

  console.log(
    "Registered By :",
    config[8]
  );

  console.log(
    "Active        :",
    config[9]
  );

  console.log();


  // ==========================================================
  // 4. SIMULATED SLA MEASUREMENT
  // ==========================================================
  //
  // This represents an actual-style measurement:
  //
  // Bandwidth       = 125.99 Mbps
  // Average latency = 5.182 ms
  // Packet loss     = 0.00 %
  //
  // Slice-1 SLA:
  //
  // Minimum BW      = 140 Mbps
  // Maximum latency = 5 ms
  // Maximum loss    = 1 %
  //
  // Result:
  //
  // Bandwidth       = VIOLATION
  // Latency         = VIOLATION
  // Packet loss     = COMPLIANT
  //
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("4. Preparing SLA measurement");
  console.log("----------------------------------------------");

  const requiredBandwidthMbps = 150;

  const measuredBandwidthMbps = 125.99;

  const measuredLatencyMs = 5.182;

  const measuredPacketLossPercent = 0.00;


  // ==========================================================
  // CONVERT TO INTEGER VALUES FOR SOLIDITY
  // ==========================================================

  const measuredBandwidthCentiMbps =
    Math.round(
      measuredBandwidthMbps *
      BANDWIDTH_SCALE
    );

  const measuredLatencyMicroseconds =
    Math.round(
      measuredLatencyMs *
      LATENCY_SCALE
    );

  const measuredPacketLossCentiPercent =
    Math.round(
      measuredPacketLossPercent *
      PACKET_LOSS_SCALE
    );


  // ==========================================================
  // SLA COMPLIANCE EVALUATION
  // ==========================================================

  const bandwidthCompliant =
    measuredBandwidthMbps >= 140;

  const latencyCompliant =
    measuredLatencyMs <= 5;

  const packetLossCompliant =
    measuredPacketLossPercent <= 1;


  console.log(
    "Required bandwidth :",
    requiredBandwidthMbps,
    "Mbps"
  );

  console.log(
    "Measured bandwidth :",
    measuredBandwidthMbps,
    "Mbps"
  );

  console.log(
    "On-chain bandwidth :",
    measuredBandwidthCentiMbps
  );

  console.log();

  console.log(
    "Measured latency   :",
    measuredLatencyMs,
    "ms"
  );

  console.log(
    "On-chain latency   :",
    measuredLatencyMicroseconds
  );

  console.log();

  console.log(
    "Measured loss      :",
    measuredPacketLossPercent,
    "%"
  );

  console.log(
    "On-chain loss      :",
    measuredPacketLossCentiPercent
  );

  console.log();

  console.log(
    "Bandwidth compliant   :",
    bandwidthCompliant
  );

  console.log(
    "Latency compliant     :",
    latencyCompliant
  );

  console.log(
    "Packet loss compliant :",
    packetLossCompliant
  );

  console.log();


  // ==========================================================
  // 5. RECORD SLA MEASUREMENT ON BLOCKCHAIN
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("5. Recording SLA measurement");
  console.log("----------------------------------------------");

  const slaTx =
    await contract.recordSLAMeasurement(
      "SLICE-1",

      requiredBandwidthMbps,

      measuredBandwidthCentiMbps,

      measuredLatencyMicroseconds,

      measuredPacketLossCentiPercent,

      bandwidthCompliant,

      latencyCompliant,

      packetLossCompliant
    );

  const slaReceipt =
    await slaTx.wait();

  console.log(
    "SLA transaction:",
    slaReceipt?.hash
  );

  console.log(
    "SLA measurement recorded successfully."
  );

  console.log();


  // ==========================================================
  // 6. READ SLA MEASUREMENT
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("6. Reading SLA measurement from blockchain");
  console.log("----------------------------------------------");

  const measurementCount =
    await contract.getSLAMeasurementCount(
      "SLICE-1"
    );

  console.log(
    "Measurement count:",
    measurementCount.toString()
  );

  const sla =
    await contract.getSLAMeasurement(
      "SLICE-1",
      0
    );


  console.log();

  console.log(
    "Slice ID:",
    sla[0]
  );

  console.log(
    "Required bandwidth:",
    sla[1].toString(),
    "Mbps"
  );

  console.log(
    "Stored bandwidth:",
    sla[2].toString()
  );

  console.log(
    "Decoded bandwidth:",
    Number(sla[2]) /
    BANDWIDTH_SCALE,
    "Mbps"
  );

  console.log(
    "Stored latency:",
    sla[3].toString()
  );

  console.log(
    "Decoded latency:",
    Number(sla[3]) /
    LATENCY_SCALE,
    "ms"
  );

  console.log(
    "Stored packet loss:",
    sla[4].toString()
  );

  console.log(
    "Decoded packet loss:",
    Number(sla[4]) /
    PACKET_LOSS_SCALE,
    "%"
  );

  console.log(
    "Bandwidth compliant:",
    sla[5]
  );

  console.log(
    "Latency compliant:",
    sla[6]
  );

  console.log(
    "Packet loss compliant:",
    sla[7]
  );

  console.log(
    "Timestamp:",
    sla[8].toString()
  );

  console.log(
    "Recorded by:",
    sla[9]
  );

  console.log();


  // ==========================================================
  // 7. PRECISION VERIFICATION
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("7. Verifying measurement precision");
  console.log("----------------------------------------------");

  const decodedBandwidth =
    Number(sla[2]) /
    BANDWIDTH_SCALE;

  const decodedLatency =
    Number(sla[3]) /
    LATENCY_SCALE;

  const decodedPacketLoss =
    Number(sla[4]) /
    PACKET_LOSS_SCALE;


  const bandwidthPrecisionOK =
    Math.abs(
      decodedBandwidth -
      measuredBandwidthMbps
    ) < 0.001;


  const latencyPrecisionOK =
    Math.abs(
      decodedLatency -
      measuredLatencyMs
    ) < 0.001;


  const packetLossPrecisionOK =
    Math.abs(
      decodedPacketLoss -
      measuredPacketLossPercent
    ) < 0.001;


  console.log(
    "Bandwidth precision   :",
    bandwidthPrecisionOK
      ? "PASS"
      : "FAIL"
  );

  console.log(
    "Latency precision     :",
    latencyPrecisionOK
      ? "PASS"
      : "FAIL"
  );

  console.log(
    "Packet-loss precision:",
    packetLossPrecisionOK
      ? "PASS"
      : "FAIL"
  );

  console.log();


  // ==========================================================
  // 8. RECORD VIOLATIONS
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("8. Recording SLA violations");
  console.log("----------------------------------------------");


  if (!bandwidthCompliant) {

    const bandwidthViolationTx =
      await contract.recordViolation(
        "SLICE-1",
        "BANDWIDTH",
        "Measured bandwidth was below the minimum SLA threshold of 140 Mbps."
      );

    await bandwidthViolationTx.wait();

    console.log(
      "Bandwidth violation recorded."
    );
  }


  if (!latencyCompliant) {

    const latencyViolationTx =
      await contract.recordViolation(
        "SLICE-1",
        "LATENCY",
        "Average latency exceeded the maximum SLA threshold of 5 ms."
      );

    await latencyViolationTx.wait();

    console.log(
      "Latency violation recorded."
    );
  }


  if (packetLossCompliant) {

    console.log(
      "Packet loss: no violation."
    );
  }


  console.log();


  // ==========================================================
  // 9. READ VIOLATIONS
  // ==========================================================

  console.log("----------------------------------------------");
  console.log("9. Reading recorded violations");
  console.log("----------------------------------------------");

  const violationCount =
    await contract.getViolationCount(
      "SLICE-1"
    );

  console.log(
    "Violation count:",
    violationCount.toString()
  );


  for (
    let i = 0;
    i < Number(violationCount);
    i++
  ) {

    const violation =
      await contract.getViolation(
        "SLICE-1",
        i
      );

    console.log();

    console.log(
      "Violation #",
      i + 1
    );

    console.log(
      "Type:",
      violation[1]
    );

    console.log(
      "Description:",
      violation[2]
    );

    console.log(
      "Timestamp:",
      violation[3].toString()
    );

    console.log(
      "Reported by:",
      violation[4]
    );
  }


  // ==========================================================
  // FINAL RESULT
  // ==========================================================

  console.log();
  console.log("==============================================");
  console.log(" FINAL CONTRACT TEST RESULT");
  console.log("==============================================");

  console.log(
    "Contract address:",
    contractAddress
  );

  console.log(
    "Bandwidth precision:",
    bandwidthPrecisionOK
      ? "PASS"
      : "FAIL"
  );

  console.log(
    "Latency precision:",
    latencyPrecisionOK
      ? "PASS"
      : "FAIL"
  );

  console.log(
    "Packet-loss precision:",
    packetLossPrecisionOK
      ? "PASS"
      : "FAIL"
  );

  console.log(
    "Overall precision:",
    bandwidthPrecisionOK &&
    latencyPrecisionOK &&
    packetLossPrecisionOK
      ? "PASS"
      : "FAIL"
  );

  console.log("==============================================");
  console.log();
}


main().catch((error) => {

  console.error();
  console.error("==============================================");
  console.error(" CONTRACT TEST FAILED");
  console.error("==============================================");
  console.error(error);

  process.exitCode = 1;
});
