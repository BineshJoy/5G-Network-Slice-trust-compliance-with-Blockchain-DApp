/* ==========================================================
   5G NETWORK SLICE SECURITY DAPP
   ========================================================== */

/* ==========================================================
   CONFIGURATION
   ========================================================== */

const API_BASE =
    "http://10.94.244.10:5000";

const CONTRACT_ADDRESSES = {
    31337: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
  11155111: "0xcA27F892E14b39Df203faD0d5549181E5F351E70"
};

/* ==========================================================
   STATE
   ========================================================== */

let provider = null;

let signer = null;

let walletAddress = null;


/* ==========================================================
   DOM HELPER
   ========================================================== */

function $(id) {

    return document.getElementById(
        id
    );

}


/* ==========================================================
   FORMAT ADDRESS
   ========================================================== */

function shortAddress(
    address
) {

    if (!address) {
        return "—";
    }

    if (address.length < 12) {
        return address;
    }

    return (
        address.substring(0, 6)
        +
        "..."
        +
        address.substring(
            address.length - 4
        )
    );

}


/* ==========================================================
   FORMAT NUMBER
   ========================================================== */

function formatNumber(
    value,
    decimals = 3
) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toFixed(
        decimals
    );

}


/* ==========================================================
   SET BADGE
   ========================================================== */

function setBadge(
    element,
    type,
    text
) {

    element.className =
        "result-badge "
        +
        type;

    element.textContent =
        text;

}


/* ==========================================================
   API REQUEST
   ========================================================== */

async function apiRequest(
    path,
    options = {}
) {

    const response =
        await fetch(
            API_BASE + path,
            options
        );

    let data;

    try {

        data =
            await response.json();

    } catch (error) {

        throw new Error(
            "API returned invalid JSON."
        );

    }

    if (!response.ok) {

        throw new Error(
            data.error
            ||
            `HTTP ${response.status}`
        );

    }

    return data;

}


/* ==========================================================
   API HEALTH
   ========================================================== */

async function checkApiHealth() {

    const dot =
        $("apiStatusDot");

    const text =
        $("apiStatusText");

    try {

        const data =
            await apiRequest(
                "/api/health"
            );

        if (
            data.success
            &&
            data.status === "running"
        ) {

            dot.className =
                "status-dot online";

            text.textContent =
                "5G Security API online";

        } else {

            throw new Error(
                "API unavailable"
            );

        }

    } catch (error) {

        dot.className =
            "status-dot offline";

        text.textContent =
            "5G Security API offline";

        console.error(
            error
        );

    }

}


/* ==========================================================
   META MASK
   ========================================================== */

async function connectWallet() {

    if (
        typeof window.ethereum ===
        "undefined"
    ) {

        alert(
            "MetaMask is not installed. " +
            "Please install MetaMask first."
        );

        return;

    }

    try {

        provider =
            new ethers.BrowserProvider(
                window.ethereum,
            );

        await provider.send(
            "eth_requestAccounts",
            []
        );

        signer = await
            provider.getSigner();

        walletAddress =
            await signer.getAddress();

        const network =
            await provider.getNetwork();

        const chainId =
            Number(
                network.chainId
            );

        $("walletAddress")
            .textContent =
            shortAddress(
                walletAddress
            );

        $("chainId")
            .textContent =
            chainId;

        $("blockchainNetwork")
            .textContent =
            network.name ===
            "unknown"
                ? "Hardhat Local"
                : network.name;

        const selectedContractAddress =
        CONTRACT_ADDRESSES[chainId];

        $("contractAddress").textContent =
        selectedContractAddress || "Unsupported network";

        if (selectedContractAddress) {


            $("networkStatus").className =
                "status-pill online";

            $("networkStatus").textContent =
                chainId === 31337
                    ? "🟢 Hardhat Local"
                    :"🟢 Sepolia";

            $("blockchainStatus").className =
                "status-pill online";

            $("blockchainStatus").textContent =
                "Connected";

        } else {

            $("networkStatus").className =
                "status-pill offline";

            $("networkStatus").textContent =
                "● Wrong Network";

            $("blockchainStatus").className =
                "status-pill offline";

            $("blockchainStatus").textContent =
                `Chain ${chainId}`;

        }


        $("connectWalletBtn")
            .textContent =
            shortAddress(
                walletAddress
            );


    } catch (error) {

        console.error(
            "Wallet connection error:",
            error
        );

    }

}


/* ==========================================================
   WALLET EVENTS
   ========================================================== */

function setupWalletEvents() {

    if (
        typeof window.ethereum ===
        "undefined"
    ) {
        return;
    }

    window.ethereum.on(
        "accountsChanged",
        () => {

            connectWallet();

        }
    );


    window.ethereum.on(
        "chainChanged",
        () => {

            window.location.reload();

        }
    );

}


/* ==========================================================
   LOAD SLICE CONFIGURATION
   ========================================================== */

async function loadSliceConfig(
    sliceNumber
) {

    const prefix =
        `s${sliceNumber}`;

    try {

        const data =
            await apiRequest(
                `/api/config/${sliceNumber}`
            );

        if (!data.success) {

            throw new Error(
                data.error
                ||
                "Unable to load configuration."
            );

        }

        const config =
            data.configuration;


        /* ---------------------------------------------
           Identity
        --------------------------------------------- */

        $(`${prefix}SliceId`)
            .textContent =
            config.slice_id
            || "—";

        $(`${prefix}Sst`)
            .textContent =
            config.sst
            ?? "—";

        $(`${prefix}Sd`)
            .textContent =
            config.sd
            || "—";

        $(`${prefix}Dnn`)
            .textContent =
            config.dnn
            || "—";


        /* ---------------------------------------------
           Core
        --------------------------------------------- */

        $(`${prefix}Smf`)
            .textContent =
            config.smf
            || "—";

        $(`${prefix}SmfIp`)
            .textContent =
            config.smf_ip
            || "—";


        /* ---------------------------------------------
           UPF
        --------------------------------------------- */

        $(`${prefix}Upf`)
            .textContent =
            config.upf
            || "—";

        $(`${prefix}UpfIp`)
            .textContent =
            config.upf_ip
            || "—";


        /* ---------------------------------------------
           Radio / UE
        --------------------------------------------- */

        $(`${prefix}GnbIp`)
            .textContent =
            config.gnb_ip
            || "—";

        $(`${prefix}UeIp`)
            .textContent =
            config.ue_ip
            || "No active UE";


        $(`${prefix}Supi`)
            .textContent =
            config.supi
            || "—";


        /* ---------------------------------------------
           PDU status
        --------------------------------------------- */

        const pduElement =
            $(`${prefix}PduStatus`);

        pduElement.textContent =
            config.pdu_status
            || "—";

        pduElement.className =
            "";

        if (
            String(
                config.pdu_status
            ).toLowerCase()
            === "active"
        ) {

            pduElement.className =
                "active";

        } else {

            pduElement.className =
                "inactive";

        }


        /* ---------------------------------------------
           SLA policy
        --------------------------------------------- */

        $(`${prefix}RequiredBandwidth`)
            .textContent =
            `${formatNumber(
                config.required_bandwidth_mbps,
                1
            )} Mbps`;


        $(`${prefix}MinimumBandwidth`)
            .textContent =
            `${formatNumber(
                config.minimum_bandwidth_mbps,
                1
            )} Mbps`;


        $(`${prefix}MaximumLatency`)
            .textContent =
            `${formatNumber(
                config.maximum_latency_ms,
                1
            )} ms`;


        $(`${prefix}MaximumLoss`)
            .textContent =
            `${formatNumber(
                config.maximum_packet_loss_percent,
                1
            )}%`;


        return data;


    } catch (error) {

        console.error(
            `Slice ${sliceNumber} configuration error:`,
            error
        );

        $(`${prefix}TestMessage`)
            .textContent =
            "Unable to read live configuration.";

        $(`${prefix}TestMessage`)
            .className =
            "test-message error";

        throw error;

    }

}


/* ==========================================================
   REFRESH BOTH CONFIGURATIONS
   ========================================================== */

async function loadAllConfigurations() {

    try {

        await Promise.all([
            loadSliceConfig(1),
            loadSliceConfig(2)
        ]);

    } catch (error) {

        console.error(
            error
        );

    }

}


/* ==========================================================
   SET TEST BUTTON STATE
   ========================================================== */

function setTestRunning(
    sliceNumber,
    running
) {

    const button =
        $(
            `runSlice${sliceNumber}Btn`
        );

    const message =
        $(
            `s${sliceNumber}TestMessage`
        );

    if (running) {

        button.disabled =
            true;

        button.textContent =
            "⏳ Running real SLA test...";

        message.textContent =
            "iperf3 and latency measurement are running...";

        message.className =
            "test-message running";

    } else {

        button.disabled =
            false;

        button.textContent =
            `▶ Run Slice ${sliceNumber} SLA Test`;

    }

}


/* ==========================================================
   RENDER METRIC
   ========================================================== */

function renderMetric(
    elementId,
    status,
    passText = "PASS",
    failText = "VIOLATION"
) {

    const element =
        $(elementId);

    if (status) {

        element.className =
            "metric-status pass";

        element.textContent =
            passText;

    } else {

        element.className =
            "metric-status fail";

        element.textContent =
            failText;

    }

}


/* ==========================================================
   RENDER BLOCKCHAIN TRANSACTIONS
   ========================================================== */

function renderBlockchain(
    sliceNumber,
    blockchain
) {

    const prefix =
        `s${sliceNumber}`;

    if (
        !blockchain
        ||
        !blockchain.success
    ) {

        $(`${prefix}BlockchainStatus`)
            .className =
            "result-badge fail";

        $(`${prefix}BlockchainStatus`)
            .textContent =
            "Recording Failed";

        return;

    }


    $(`${prefix}BlockchainStatus`)
        .className =
        "result-badge pass";

    $(`${prefix}BlockchainStatus`)
        .textContent =
        "Recorded";


    /* ---------------------------------------------
       Measurement transaction
    --------------------------------------------- */

    const measurementTx =
        blockchain.measurement
            ?.transaction_hash
        || "—";


    $(`${prefix}MeasurementTx`)
        .textContent =
        measurementTx;


    /* ---------------------------------------------
       Violations
    --------------------------------------------- */

    const container =
        $(`${prefix}Violations`);

    container.innerHTML =
        "";


    const violations =
        blockchain.violations
        || [];


    if (
        violations.length === 0
    ) {

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "transaction-item";

        item.innerHTML = `
            <div>
                <span>Violation Records</span>
                <strong>No violations</strong>
            </div>

            <code>
                All SLA metrics passed
            </code>

            <span></span>
        `;

        container.appendChild(
            item
        );

        return;

    }


    violations.forEach(
        (violation) => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "violation-item";

            const safeType =
                String(
                    violation.type
                    || "UNKNOWN"
                );

            const safeDescription =
                String(
                    violation.description
                    || ""
                );

            const tx =
                String(
                    violation.transaction_hash
                    || "—"
                );


            item.innerHTML = `
                <div>
                    <span class="violation-type">
                        ${safeType} Violation
                    </span>
                </div>

                <div>
                    <div class="violation-description">
                        ${safeDescription}
                    </div>

                    <code>
                        ${tx}
                    </code>
                </div>

                <button
                    class="copy-btn"
                    data-copy-value="${tx}"
                >
                    Copy
                </button>
            `;


            container.appendChild(
                item
            );

        }
    );

}


/* ==========================================================
   RENDER SLA RESULT
   ========================================================== */

function renderSlaResult(
    sliceNumber,
    response
) {

    const prefix =
        `s${sliceNumber}`;

    const result =
        response.result;


    /* ---------------------------------------------
       Show result panel
    --------------------------------------------- */

    $(`${prefix}Result`)
        .classList
        .remove("hidden");


    /* ---------------------------------------------
       Overall
    --------------------------------------------- */

    const overall =
        Boolean(
            result.overall_compliant
        );


    setBadge(
        $(`${prefix}Overall`),
        overall
            ? "pass"
            : "fail",
        overall
            ? "SLA PASS"
            : "SLA FAILED"
    );


    setBadge(
        $(`slice${sliceNumber}Status`),
        overall
            ? "pass"
            : "fail",
        overall
            ? "PASS"
            : "VIOLATION"
    );


    /* ---------------------------------------------
       Bandwidth
    --------------------------------------------- */

    const bandwidth =
        result.bandwidth
        || {};


    $(`${prefix}MeasuredBandwidth`)
        .textContent =
        `${formatNumber(
            bandwidth.measured_mbps,
            3
        )} Mbps`;


    $(`${prefix}BandwidthThreshold`)
        .textContent =
        `Minimum: ${formatNumber(
            bandwidth.minimum_mbps,
            1
        )} Mbps`;


    renderMetric(
        `${prefix}BandwidthStatus`,
        Boolean(
            bandwidth.compliant
        )
    );


    /* ---------------------------------------------
       Latency
    --------------------------------------------- */

    const latency =
        result.latency
        || {};


    $(`${prefix}MeasuredLatency`)
        .textContent =
        `${formatNumber(
            latency.measured_average_ms,
            3
        )} ms`;


    $(`${prefix}LatencyThreshold`)
        .textContent =
        `Maximum: ${formatNumber(
            latency.maximum_average_ms,
            1
        )} ms`;


    renderMetric(
        `${prefix}LatencyStatus`,
        Boolean(
            latency.compliant
        )
    );


    /* ---------------------------------------------
       Packet loss
    --------------------------------------------- */

    const packetLoss =
        result.packet_loss
        || {};


    $(`${prefix}MeasuredLoss`)
        .textContent =
        `${formatNumber(
            packetLoss.measured_percent,
            2
        )}%`;


    $(`${prefix}LossThreshold`)
        .textContent =
        `Maximum: ${formatNumber(
            packetLoss.maximum_percent,
            1
        )}%`;


    renderMetric(
        `${prefix}LossStatus`,
        Boolean(
            packetLoss.compliant
        )
    );


    /* ---------------------------------------------
       Blockchain
    --------------------------------------------- */

    renderBlockchain(
        sliceNumber,
        result.blockchain
    );

}


/* ==========================================================
   RUN SLA TEST
   ========================================================== */

async function runSlaTest(
    sliceNumber
) {

    const prefix =
        `s${sliceNumber}`;

    const message =
        $(`${prefix}TestMessage`);

    setTestRunning(
        sliceNumber,
        true
    );


    try {

        /*
         * Refresh configuration immediately before
         * the real SLA test so that the GUI displays
         * the current UE/session state.
         */

        await loadSliceConfig(
            sliceNumber
        );


        /*
         * Run the EXISTING backend SLA test.
         *
         * No measurement logic is duplicated here.
         */

        const response =
            await apiRequest(
                `/api/sla-test/${sliceNumber}`,
                {
                    method: "POST"
                }
            );


        if (
            !response.success
        ) {

            throw new Error(
                response.error
                ||
                "SLA test failed."
            );

        }


        renderSlaResult(
            sliceNumber,
            response
        );


        message.textContent =
            "Real SLA test completed.";

        message.className =
            "test-message success";


        /*
         * Refresh live configuration because
         * the UE IP/session state can change.
         */

        await loadSliceConfig(
            sliceNumber
        );


    } catch (error) {

        console.error(
            `Slice ${sliceNumber} SLA test error:`,
            error
        );


        message.textContent =
            error.message
            ||
            "SLA test failed.";

        message.className =
            "test-message error";


        setBadge(
            $(`slice${sliceNumber}Status`),
            "fail",
            "TEST ERROR"
        );

    } finally {

        setTestRunning(
            sliceNumber,
            false
        );

    }

}


/* ==========================================================
   COPY TRANSACTION
   ========================================================== */

async function copyText(
    value
) {

    try {

        await navigator.clipboard.writeText(
            value
        );

    } catch (error) {

        console.error(
            "Copy failed:",
            error
        );

    }

}


/* ==========================================================
   COPY BUTTONS
   ========================================================== */

document.addEventListener(
    "click",
    async (event) => {

        const button =
            event.target.closest(
                ".copy-btn"
            );

        if (!button) {
            return;
        }


        const targetId =
            button.dataset.copyTarget;


        if (targetId) {

            const target =
                $(targetId);

            if (target) {

                await copyText(
                    target.textContent.trim()
                );

            }

        } else {

            const value =
                button.dataset.copyValue;

            if (value) {

                await copyText(
                    value
                );

            }

        }


        const oldText =
            button.textContent;

        button.textContent =
            "Copied";

        setTimeout(
            () => {

                button.textContent =
                    oldText;

            },
            1200
        );

    }
);


/* ==========================================================
   EVENT LISTENERS
   ========================================================== */

$("connectWalletBtn")
    .addEventListener(
        "click",
        connectWallet
    );


$("refreshSlice1Btn")
    .addEventListener(
        "click",
        () => loadSliceConfig(1)
    );


$("refreshSlice2Btn")
    .addEventListener(
        "click",
        () => loadSliceConfig(2)
    );


$("runSlice1Btn")
    .addEventListener(
        "click",
        () => runSlaTest(1)
    );


$("runSlice2Btn")
    .addEventListener(
        "click",
        () => runSlaTest(2)
    );


/* ==========================================================
   INITIALIZATION
   ========================================================== */

async function initialize() {

    console.log(
        "Initializing 5G Network Slice Security DApp..."
    );


    await checkApiHealth();


    await loadAllConfigurations();


    setupWalletEvents();


    /*
     * If MetaMask is already available, attempt to
     * read the currently connected account without
     * forcing a new permission request.
     */

    if (
        typeof window.ethereum !==
        "undefined"
    ) {

        try {

            const accounts =
                await window.ethereum.request({
                    method:
                        "eth_accounts"
                });


            if (
                accounts.length > 0
            ) {

                await connectWallet();

            }

        } catch (error) {

            console.error(
                "Initial wallet check failed:",
                error
            );

        }

    }

}



/* ==========================================================
   SEPOLIA DEMO TRANSACTION
   Separate from the live Open5GS SLA workflow
   ========================================================== */

async function recordSepoliaDemoMeasurement() {
    const button = $("sepoliaDemoBtn");
    const status = $("sepoliaDemoStatus");
    const txOutput = $("sepoliaDemoTx");

    try {
        button.disabled = true;
        status.textContent = "Checking MetaMask and Sepolia...";
        txOutput.textContent = "";

        if (typeof window.ethereum === "undefined") {
            throw new Error("MetaMask is not available in this browser.");
        }

        if (!provider || !signer) {
            await connectWallet();
        }

        if (!provider || !signer) {
            throw new Error("Wallet connection failed. Reconnect MetaMask and retry.");
        }

        const network = await provider.getNetwork();
        if (Number(network.chainId) !== 11155111) {
            throw new Error("Please select Sepolia in MetaMask (Chain ID 11155111).");
        }

        const contractAddress = CONTRACT_ADDRESSES[11155111];
        if (!contractAddress) {
            throw new Error("Sepolia contract address is not configured.");
        }

        const selectedSlice = $("sepoliaDemoSlice").value;
        const isSlice1 = selectedSlice === "1";

        // Clearly labelled demo values; these are not live measurements.
        const demo = isSlice1
            ? {
                sliceId: "SLICE-1",
                requiredBandwidthMbps: 150,
                measuredBandwidthCentiMbps: 14500,
                measuredLatencyMicroseconds: 4000,
                measuredPacketLossCentiPercent: 10
              }
            : {
                sliceId: "SLICE-2",
                requiredBandwidthMbps: 75,
                measuredBandwidthCentiMbps: 7000,
                measuredLatencyMicroseconds: 4000,
                measuredPacketLossCentiPercent: 10
              };

        status.textContent = "Loading contract ABI...";
        const response = await fetch("contract-abi.json", { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Could not load frontend/contract-abi.json.");
        }

        const abiDocument = await response.json();
        const abi = abiDocument.abi;
        if (!Array.isArray(abi) ||
            !abi.some(item => item.name === "recordSLAMeasurement")) {
            throw new Error("The ABI does not contain recordSLAMeasurement.");
        }

        const contract = new ethers.Contract(contractAddress, abi, signer);

        status.textContent = "Confirm the transaction in MetaMask...";
        const tx = await contract.recordSLAMeasurement(
            demo.sliceId,
            demo.requiredBandwidthMbps,
            demo.measuredBandwidthCentiMbps,
            demo.measuredLatencyMicroseconds,
            demo.measuredPacketLossCentiPercent,
            true,
            true,
            true
        );

        status.textContent = "Transaction submitted. Waiting for Sepolia confirmation...";
        txOutput.textContent = "Transaction hash: " + tx.hash;

        await tx.wait();

        status.textContent = "Confirmed on Sepolia. Demo data only.";
        txOutput.innerHTML =
            'Confirmed transaction: <a target="_blank" rel="noopener noreferrer" ' +
            'href="https://sepolia.etherscan.io/tx/' + tx.hash + '">' +
            tx.hash + '</a>';

    } catch (error) {
        console.error("Sepolia demo transaction failed:", error);
        status.textContent = "Failed: " + (error.shortMessage || error.message || "Unknown error");
    } finally {
        button.disabled = false;
    }
}




const sepoliaDemoButton = $("sepoliaDemoBtn");
if (sepoliaDemoButton) {
    sepoliaDemoButton.addEventListener(
        "click",
        recordSepoliaDemoMeasurement
    );
}

initialize();
