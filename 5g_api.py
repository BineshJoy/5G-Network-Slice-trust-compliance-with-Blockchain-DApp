#!/usr/bin/env python3

# ============================================================
# 5G NETWORK SLICE SECURITY API
# ============================================================
#
# Purpose:
#   Bridge the Web GUI with:
#     1. The existing 5G SLA measurement engine
#     2. The live Open5GS network
#     3. The Ethereum blockchain SLA recording layer
#
# IMPORTANT:
#   This API does NOT duplicate the SLA measurement logic.
#
# Existing measurement engine:
#   5g_sla_test.py
#
# Blockchain adapter:
#   blockchain_sla_adapter.mjs
#
# API:
#   GET  /api/health
#   GET  /api/config/1
#   GET  /api/config/2
#   POST /api/sla-test/1
#   POST /api/sla-test/2
#
# ============================================================

import json
import importlib.util
import subprocess
import traceback

from pathlib import Path

from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer

from urllib.parse import urlparse


# ============================================================
# LOAD EXISTING 5G SLA TEST MODULE
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MODULE_PATH = BASE_DIR / "5g_sla_test.py"

spec = importlib.util.spec_from_file_location(
    "fiveg_sla_test",
    str(MODULE_PATH)
)

if spec is None or spec.loader is None:
    raise RuntimeError(
        f"Unable to load {MODULE_PATH}"
    )

fiveg_sla_test = importlib.util.module_from_spec(spec)

spec.loader.exec_module(fiveg_sla_test)


# ============================================================
# SERVER CONFIGURATION
# ============================================================

HOST = "0.0.0.0"
PORT = 5000


# ============================================================
# BLOCKCHAIN CONFIGURATION
# ============================================================

BLOCKCHAIN_ADAPTER = BASE_DIR / "blockchain_sla_adapter.mjs"


# ============================================================
# 5G LAB STATIC INFRASTRUCTURE
# ============================================================
#
# These addresses represent the physical/virtual topology
# of the 5G laboratory.
#
# gNB / UERANSIM:
#   10.94.244.1
#
# SMF-01:
#   10.94.244.17
#
# SMF-02:
#   10.94.244.18
#
# UPF-01:
#   10.94.244.244
#
# UPF-02:
#   10.94.244.122
#
# ============================================================

GNB_IP = "10.94.244.1"


SLICE_INFRASTRUCTURE = {

    1: {
        "slice_id": "SLICE-1",
        "smf": "SMF-01",
        "smf_ip": "10.94.244.17",
        "upf": "UPF-01",
        "upf_ip": "10.94.244.244",
    },

    2: {
        "slice_id": "SLICE-2",
        "smf": "SMF-02",
        "smf_ip": "10.94.244.18",
        "upf": "UPF-02",
        "upf_ip": "10.94.244.122",
    }

}


# ============================================================
# HELPER: SELECT SLICE
# ============================================================

def get_slice_name(slice_number):

    if slice_number == 1:
        return "SLICE-1"

    if slice_number == 2:
        return "SLICE-2"

    raise ValueError(
        "Invalid slice number. Use 1 or 2."
    )


# ============================================================
# HELPER: CONVERT VALUES TO JSON-SAFE TYPES
# ============================================================

def make_json_safe(value):

    if value is None:
        return None

    if isinstance(value, dict):
        return {
            str(key): make_json_safe(val)
            for key, val in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [
            make_json_safe(item)
            for item in value
        ]

    if isinstance(value, (str, int, float, bool)):
        return value

    return str(value)


# ============================================================
# LIVE 5G CONFIGURATION
# ============================================================

def get_slice_config(slice_number):

    # --------------------------------------------------------
    # Identify slice
    # --------------------------------------------------------

    slice_name = get_slice_name(
        slice_number
    )

    # --------------------------------------------------------
    # Get configuration directly from the existing
    # 5g_sla_test.py file.
    #
    # IMPORTANT:
    # These values are NOT entered by the GUI.
    # --------------------------------------------------------

    config = fiveg_sla_test.SLICES[
        slice_name
    ]

    # --------------------------------------------------------
    # Infrastructure information
    # --------------------------------------------------------

    infrastructure = SLICE_INFRASTRUCTURE[
        slice_number
    ]

    # --------------------------------------------------------
    # Query the REAL Open5GS network using the existing
    # get_session() function.
    #
    # This dynamically discovers:
    #   SUPI
    #   UE IP
    #   S-NSSAI
    #   DNN
    #   PDU state
    # --------------------------------------------------------

    session = fiveg_sla_test.get_session(
        config
    )

    # --------------------------------------------------------
    # Default values
    # --------------------------------------------------------

    sst = 1

    sd = config.get(
        "expected_sd",
        ""
    )

    dnn = "internet"

    ue_ip = None

    pdu_status = "inactive"

    supi = None

    # --------------------------------------------------------
    # ACTIVE SESSION FOUND
    # --------------------------------------------------------

    if session:

        # ----------------------------------------------------
        # Actual get_session() structure:
        #
        # {
        #   "supi": "...",
        #   "ue_ip": "...",
        #   "id": ...,
        #   "snssai": {
        #       "sst": 1,
        #       "sd": "010203"
        #   },
        #   "dnn": "internet",
        #   "pdu_state": "active"
        # }
        # ----------------------------------------------------

        supi = session.get(
            "supi"
        )

        ue_ip = session.get(
            "ue_ip"
        )

        snssai = session.get(
            "snssai",
            {}
        )

        if isinstance(snssai, dict):

            sst = snssai.get(
                "sst",
                1
            )

            sd = snssai.get(
                "sd",
                config.get(
                    "expected_sd",
                    ""
                )
            )

        dnn = session.get(
            "dnn",
            "internet"
        )

        pdu_status = session.get(
            "pdu_state",
            "unknown"
        )

    # --------------------------------------------------------
    # READ-ONLY SLA POLICY
    #
    # These values come directly from 5g_sla_test.py.
    #
    # The GUI does NOT edit them.
    # --------------------------------------------------------

    required_bandwidth = config.get(
        "required_mbps"
    )

    minimum_bandwidth = config.get(
        "min_bandwidth_mbps"
    )

    maximum_latency = config.get(
        "max_latency_ms"
    )

    maximum_packet_loss = config.get(
        "max_packet_loss"
    )

    # --------------------------------------------------------
    # Return complete LIVE configuration
    # --------------------------------------------------------

    return {
        "success": True,

        "slice": slice_name,

        "configuration": {

            # ------------------------------------------------
            # Slice identity
            # ------------------------------------------------

            "slice_id": slice_name,

            "sst": sst,

            "sd": sd,

            "dnn": dnn,

            # ------------------------------------------------
            # Core network
            # ------------------------------------------------

            "smf": infrastructure[
                "smf"
            ],

            "smf_ip": infrastructure[
                "smf_ip"
            ],

            # ------------------------------------------------
            # User plane
            # ------------------------------------------------

            "upf": infrastructure[
                "upf"
            ],

            "upf_ip": infrastructure[
                "upf_ip"
            ],

            # ------------------------------------------------
            # Radio / UE
            # ------------------------------------------------

            "gnb_ip": GNB_IP,

            "ue_ip": ue_ip,

            "supi": supi,

            # ------------------------------------------------
            # PDU session
            # ------------------------------------------------

            "pdu_status": pdu_status,

            # ------------------------------------------------
            # Open5GS monitoring API
            # ------------------------------------------------

            "smf_api": config.get(
                "smf_api"
            ),

            # ------------------------------------------------
            # READ-ONLY SLA POLICY
            # ------------------------------------------------

            "required_bandwidth_mbps":
                required_bandwidth,

            "minimum_bandwidth_mbps":
                minimum_bandwidth,

            "maximum_latency_ms":
                maximum_latency,

            "maximum_packet_loss_percent":
                maximum_packet_loss
        }
    }


# ============================================================
# BLOCKCHAIN SLA RECORDING
# ============================================================

def record_sla_on_blockchain(sla_result):

    """
    Send the REAL 5G SLA result to the Ethereum smart contract.

    The Node.js adapter performs:

      1. SLA measurement recording
      2. Bandwidth violation recording
      3. Latency violation recording
      4. Packet-loss violation recording

    Only failed metrics generate violation transactions.
    """

    # --------------------------------------------------------
    # Check adapter
    # --------------------------------------------------------

    if not BLOCKCHAIN_ADAPTER.exists():

        raise RuntimeError(
            "Blockchain adapter not found: "
            f"{BLOCKCHAIN_ADAPTER}"
        )

    # --------------------------------------------------------
    # Build JSON payload
    # --------------------------------------------------------

    payload = {
        "action": "record-sla",
        "result": sla_result
    }

    # --------------------------------------------------------
    # Execute Node.js blockchain adapter
    # --------------------------------------------------------

    try:

        completed = subprocess.run(

            [
                "node",
                str(BLOCKCHAIN_ADAPTER)
            ],

            input=json.dumps(
                payload
            ),

            text=True,

            capture_output=True,

            timeout=120,

            cwd=str(BASE_DIR)
        )

    except subprocess.TimeoutExpired:

        raise RuntimeError(
            "Blockchain transaction timed out "
            "after 120 seconds."
        )

    # --------------------------------------------------------
    # Check Node.js return code
    # --------------------------------------------------------

    if completed.returncode != 0:

        error_output = (
            completed.stderr.strip()
            or completed.stdout.strip()
            or "Unknown blockchain error."
        )

        raise RuntimeError(
            "Blockchain recording failed: "
            + error_output
        )

    # --------------------------------------------------------
    # Read adapter output
    # --------------------------------------------------------

    output = completed.stdout.strip()

    if not output:

        raise RuntimeError(
            "Blockchain adapter returned no output."
        )

    # --------------------------------------------------------
    # The adapter prints status messages before the final
    # JSON object.
    #
    # Example:
    #
    # Recording SLICE-2 SLA measurement...
    #
    # {
    #   "success": true,
    #   ...
    # }
    #
    # Extract the final JSON object.
    # --------------------------------------------------------

    start = output.rfind("\n{")

    if start >= 0:

        json_text = output[
            start + 1:
        ]

    elif output.startswith("{"):

        json_text = output

    else:

        raise RuntimeError(
            "Blockchain adapter returned invalid output."
        )

    # --------------------------------------------------------
    # Parse blockchain result
    # --------------------------------------------------------

    try:

        blockchain_result = json.loads(
            json_text
        )

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            "Unable to parse blockchain adapter "
            f"response: {exc}"
        )

    # --------------------------------------------------------
    # Validate success
    # --------------------------------------------------------

    if not blockchain_result.get(
        "success"
    ):

        raise RuntimeError(
            blockchain_result.get(
                "error",
                "Blockchain transaction failed."
            )
        )

    return blockchain_result


# ============================================================
# RUN EXISTING REAL SLA TEST
# ============================================================

def run_sla_test(slice_number):

    slice_name = get_slice_name(
        slice_number
    )

    # --------------------------------------------------------
    # Get existing configuration
    # --------------------------------------------------------

    config = fiveg_sla_test.SLICES[
        slice_name
    ]

    # --------------------------------------------------------
    # Run the EXISTING real measurement engine
    #
    # DO NOT duplicate:
    #   UE discovery
    #   iperf3
    #   ping
    #   bandwidth calculation
    #   latency calculation
    #   packet loss calculation
    #   SLA evaluation
    #
    # All of that remains inside:
    #
    #   5g_sla_test.py
    # --------------------------------------------------------

    print()

    print(
        "=" * 70
    )

    print(
        f"STARTING REAL {slice_name} SLA TEST"
    )

    print(
        "=" * 70
    )

    print()

    result = fiveg_sla_test.measure_slice(
        slice_name,
        config
    )

    # --------------------------------------------------------
    # Convert result to JSON-safe object
    # --------------------------------------------------------

    result = make_json_safe(
        result
    )

    # --------------------------------------------------------
    # RECORD REAL SLA RESULT ON BLOCKCHAIN
    # --------------------------------------------------------

    print()

    print(
        "=" * 70
    )

    print(
        "RECORDING SLA RESULT ON BLOCKCHAIN"
    )

    print(
        "=" * 70
    )

    blockchain_result = record_sla_on_blockchain(
        result
    )

    # --------------------------------------------------------
    # Attach blockchain result to the SAME API result
    # --------------------------------------------------------

    result["blockchain"] = (
        blockchain_result
    )

    # --------------------------------------------------------
    # Console output
    # --------------------------------------------------------

    print()

    print(
        "Blockchain recording completed."
    )

    print(
        "Measurement transaction:",
        blockchain_result[
            "measurement"
        ][
            "transaction_hash"
        ]
    )

    violations = (
        blockchain_result.get(
            "violations",
            []
        )
    )

    if violations:

        for violation in violations:

            print(
                f"{violation['type']} "
                "violation transaction:",
                violation[
                    "transaction_hash"
                ]
            )

    else:

        print(
            "No SLA violations recorded."
        )

    # --------------------------------------------------------
    # Return API result
    # --------------------------------------------------------

    return {
        "success": True,

        "slice": slice_name,

        "result": result
    }


# ============================================================
# LOG MESSAGE
# ============================================================

def log_message(
    self,
    *args
):

    print(
        "[API]",
        *args,
        flush=True
    )


# ============================================================
# HTTP JSON RESPONSE
# ============================================================

def send_json(
    self,
    status_code,
    data
):

    payload = json.dumps(
        make_json_safe(data),
        indent=2
    ).encode(
        "utf-8"
    )

    self.send_response(
        status_code
    )

    self.send_header(
        "Content-Type",
        "application/json"
    )

    self.send_header(
        "Content-Length",
        str(len(payload))
    )

    # --------------------------------------------------------
    # CORS
    # --------------------------------------------------------

    self.send_header(
        "Access-Control-Allow-Origin",
        "*"
    )

    self.send_header(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS"
    )

    self.send_header(
        "Access-Control-Allow-Headers",
        "Content-Type"
    )

    self.end_headers()

    self.wfile.write(
        payload
    )


# ============================================================
# API HANDLER
# ============================================================

class APIHandler(
    BaseHTTPRequestHandler
):

    # --------------------------------------------------------
    # Reduce default HTTP server logging
    # --------------------------------------------------------

    def log_message(
        self,
        format,
        *args
    ):

        print(
            "[HTTP]",
            format % args,
            flush=True
        )

    # --------------------------------------------------------
    # OPTIONS
    # --------------------------------------------------------

    def do_OPTIONS(self):

        self.send_response(
            204
        )

        self.send_header(
            "Access-Control-Allow-Origin",
            "*"
        )

        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, OPTIONS"
        )

        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type"
        )

        self.end_headers()

    # --------------------------------------------------------
    # GET
    # --------------------------------------------------------

    def do_GET(self):

        try:

            parsed = urlparse(
                self.path
            )

            path = parsed.path

            # =================================================
            # HEALTH
            # =================================================

            if path == "/api/health":

                send_json(
                    self,
                    200,
                    {
                        "success": True,
                        "service":
                            "5G Network Slice Security API",
                        "status":
                            "running"
                    }
                )

                return

            # =================================================
            # SLICE 1 CONFIGURATION
            # =================================================

            if path == "/api/config/1":

                result = get_slice_config(
                    1
                )

                send_json(
                    self,
                    200,
                    result
                )

                return

            # =================================================
            # SLICE 2 CONFIGURATION
            # =================================================

            if path == "/api/config/2":

                result = get_slice_config(
                    2
                )

                send_json(
                    self,
                    200,
                    result
                )

                return

            # =================================================
            # UNKNOWN ENDPOINT
            # =================================================

            send_json(
                self,
                404,
                {
                    "success": False,
                    "error":
                        "Endpoint not found"
                }
            )

        except Exception as exc:

            print()

            print(
                "[API ERROR]"
            )

            traceback.print_exc()

            send_json(
                self,
                500,
                {
                    "success": False,
                    "error": str(exc)
                }
            )

    # --------------------------------------------------------
    # POST
    # --------------------------------------------------------

    def do_POST(self):

        try:

            parsed = urlparse(
                self.path
            )

            path = parsed.path

            # =================================================
            # SLICE 1 REAL SLA TEST
            # =================================================

            if path == "/api/sla-test/1":

                print()

                print(
                    "[API] Slice-1 SLA test requested"
                )

                result = run_sla_test(
                    1
                )

                send_json(
                    self,
                    200,
                    result
                )

                return

            # =================================================
            # SLICE 2 REAL SLA TEST
            # =================================================

            if path == "/api/sla-test/2":

                print()

                print(
                    "[API] Slice-2 SLA test requested"
                )

                result = run_sla_test(
                    2
                )

                send_json(
                    self,
                    200,
                    result
                )

                return

            # =================================================
            # UNKNOWN POST ENDPOINT
            # =================================================

            send_json(
                self,
                404,
                {
                    "success": False,
                    "error":
                        "Endpoint not found"
                }
            )

        except Exception as exc:

            print()

            print(
                "[API ERROR]"
            )

            traceback.print_exc()

            send_json(
                self,
                500,
                {
                    "success": False,
                    "error": str(exc)
                }
            )


# ============================================================
# MAIN
# ============================================================

def main():

    print()

    print(
        "=" * 70
    )

    print(
        "5G NETWORK SLICE SECURITY API"
    )

    print(
        "=" * 70
    )

    print()

    print(
        f"Listening on http://{HOST}:{PORT}"
    )

    print()

    print(
        "LIVE 5G CONFIGURATION:"
    )

    print(
        "  GET  /api/config/1"
    )

    print(
        "  GET  /api/config/2"
    )

    print()

    print(
        "REAL SLA TEST:"
    )

    print(
        "  POST /api/sla-test/1"
    )

    print(
        "  POST /api/sla-test/2"
    )

    print()

    print(
        "HEALTH:"
    )

    print(
        "  GET  /api/health"
    )

    print()

    print(
        "BLOCKCHAIN:"
    )

    print(
        f"  Adapter: {BLOCKCHAIN_ADAPTER}"
    )

    print()

    print(
        "=" * 70
    )

    server = ThreadingHTTPServer(
        (
            HOST,
            PORT
        ),
        APIHandler
    )

    try:

        server.serve_forever()

    except KeyboardInterrupt:

        print()

        print(
            "API server stopped."
        )

    finally:

        server.server_close()


# ============================================================
# PROGRAM ENTRY
# ============================================================

if __name__ == "__main__":

    main()
