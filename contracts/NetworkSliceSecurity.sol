// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract NetworkSliceSecurity {

    // ============================================================
    // MEASUREMENT SCALE FACTORS
    // ============================================================
    //
    // Bandwidth:
    //   Mbps × 100
    //   125.99 Mbps -> 12599
    //
    // Latency:
    //   milliseconds × 1000
    //   5.182 ms -> 5182
    //
    // Packet loss:
    //   percentage × 100
    //   0.50% -> 50
    //
    // ============================================================

    uint256 public constant BANDWIDTH_SCALE = 100;
    uint256 public constant LATENCY_SCALE = 1000;
    uint256 public constant PACKET_LOSS_SCALE = 100;


    // ============================================================
    // DATA STRUCTURES
    // ============================================================

    struct SliceConfiguration {
        string sliceId;
        uint256 sst;
        string sd;
        string dnn;
        string smf;
        string upf;
        string configHash;
        uint256 timestamp;
        address registeredBy;
        bool active;
    }


    struct SLAMeasurement {
        string sliceId;

        // Required/configured bandwidth remains an integer Mbps value.
        uint256 requiredBandwidthMbps;

        // Measured bandwidth is Mbps × 100.
        uint256 measuredBandwidthCentiMbps;

        // Measured latency is milliseconds × 1000.
        uint256 measuredLatencyMicroseconds;

        // Measured packet loss is percentage × 100.
        uint256 measuredPacketLossCentiPercent;

        bool bandwidthCompliant;
        bool latencyCompliant;
        bool packetLossCompliant;

        uint256 timestamp;
        address recordedBy;
    }


    struct Violation {
        string sliceId;
        string violationType;
        string description;
        uint256 timestamp;
        address reportedBy;
    }


    // ============================================================
    // STORAGE
    // ============================================================

    mapping(string => SliceConfiguration)
        private configurations;

    mapping(string => SLAMeasurement[])
        private slaMeasurements;

    mapping(string => Violation[])
        private violations;


    // ============================================================
    // EVENTS
    // ============================================================

    event ConfigurationRegistered(
        string indexed sliceId,
        string configHash,
        uint256 timestamp,
        address registeredBy
    );


    event SLAMeasurementRecorded(
        string indexed sliceId,
        uint256 measuredBandwidthCentiMbps,
        uint256 measuredLatencyMicroseconds,
        uint256 measuredPacketLossCentiPercent,
        bool bandwidthCompliant,
        bool latencyCompliant,
        bool packetLossCompliant,
        uint256 timestamp
    );


    event ViolationRecorded(
        string indexed sliceId,
        string violationType,
        uint256 timestamp,
        address reportedBy
    );


    // ============================================================
    // REGISTER SLICE CONFIGURATION
    // ============================================================

    function registerConfiguration(
        string memory sliceId,
        uint256 sst,
        string memory sd,
        string memory dnn,
        string memory smf,
        string memory upf,
        string memory configHash
    ) public {

        configurations[sliceId] = SliceConfiguration({
            sliceId: sliceId,
            sst: sst,
            sd: sd,
            dnn: dnn,
            smf: smf,
            upf: upf,
            configHash: configHash,
            timestamp: block.timestamp,
            registeredBy: msg.sender,
            active: true
        });

        emit ConfigurationRegistered(
            sliceId,
            configHash,
            block.timestamp,
            msg.sender
        );
    }


    // ============================================================
    // RECORD SLA MEASUREMENT
    // ============================================================
    //
    // Caller supplies scaled integer measurements:
    //
    // measuredBandwidthCentiMbps
    // measuredLatencyMicroseconds
    // measuredPacketLossCentiPercent
    //
    // ============================================================

    function recordSLAMeasurement(
        string memory sliceId,
        uint256 requiredBandwidthMbps,
        uint256 measuredBandwidthCentiMbps,
        uint256 measuredLatencyMicroseconds,
        uint256 measuredPacketLossCentiPercent,
        bool bandwidthCompliant,
        bool latencyCompliant,
        bool packetLossCompliant
    ) public {

        slaMeasurements[sliceId].push(
            SLAMeasurement({
                sliceId: sliceId,

                requiredBandwidthMbps:
                    requiredBandwidthMbps,

                measuredBandwidthCentiMbps:
                    measuredBandwidthCentiMbps,

                measuredLatencyMicroseconds:
                    measuredLatencyMicroseconds,

                measuredPacketLossCentiPercent:
                    measuredPacketLossCentiPercent,

                bandwidthCompliant:
                    bandwidthCompliant,

                latencyCompliant:
                    latencyCompliant,

                packetLossCompliant:
                    packetLossCompliant,

                timestamp:
                    block.timestamp,

                recordedBy:
                    msg.sender
            })
        );

        emit SLAMeasurementRecorded(
            sliceId,
            measuredBandwidthCentiMbps,
            measuredLatencyMicroseconds,
            measuredPacketLossCentiPercent,
            bandwidthCompliant,
            latencyCompliant,
            packetLossCompliant,
            block.timestamp
        );
    }


    // ============================================================
    // RECORD SLA VIOLATION
    // ============================================================

    function recordViolation(
        string memory sliceId,
        string memory violationType,
        string memory description
    ) public {

        violations[sliceId].push(
            Violation({
                sliceId: sliceId,
                violationType: violationType,
                description: description,
                timestamp: block.timestamp,
                reportedBy: msg.sender
            })
        );

        emit ViolationRecorded(
            sliceId,
            violationType,
            block.timestamp,
            msg.sender
        );
    }


    // ============================================================
    // GET SLICE CONFIGURATION
    // ============================================================

    function getConfiguration(
        string memory sliceId
    )
        public
        view
        returns (
            string memory,
            uint256,
            string memory,
            string memory,
            string memory,
            string memory,
            string memory,
            uint256,
            address,
            bool
        )
    {
        SliceConfiguration memory config =
            configurations[sliceId];

        return (
            config.sliceId,
            config.sst,
            config.sd,
            config.dnn,
            config.smf,
            config.upf,
            config.configHash,
            config.timestamp,
            config.registeredBy,
            config.active
        );
    }


    // ============================================================
    // GET SLA MEASUREMENT COUNT
    // ============================================================

    function getSLAMeasurementCount(
        string memory sliceId
    )
        public
        view
        returns (uint256)
    {
        return slaMeasurements[sliceId].length;
    }


    // ============================================================
    // GET SLA MEASUREMENT
    // ============================================================

    function getSLAMeasurement(
        string memory sliceId,
        uint256 index
    )
        public
        view
        returns (SLAMeasurement memory)
    {
        return slaMeasurements[sliceId][index];
    }


    // ============================================================
    // GET VIOLATION COUNT
    // ============================================================

    function getViolationCount(
        string memory sliceId
    )
        public
        view
        returns (uint256)
    {
        return violations[sliceId].length;
    }


    // ============================================================
    // GET VIOLATION
    // ============================================================

    function getViolation(
        string memory sliceId,
        uint256 index
    )
        public
        view
        returns (Violation memory)
    {
        return violations[sliceId][index];
    }
}
