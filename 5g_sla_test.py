#!/usr/bin/env python3

import json
import subprocess
import urllib.request
import re
import sys
import time


# ============================================================
# 5G MONITORING CONFIGURATION
# ============================================================

SSH_KEY = "/home/bineshjoy/.ssh/id_ed25519_5gmonitor"
SSH_USER = "bineshjoy"

# UERANSIM host running gNB + UE
UERANSIM_HOST = "10.94.244.1"


# ============================================================
# PROJECT SLA CONFIGURATION
# ============================================================
#
# IMPORTANT:
# UE IP addresses are NOT configured here.
#
# UE IP is dynamically discovered from the Open5GS Info API
# every time the monitoring script runs.
#
# ============================================================

SLICES = {

    "SLICE-1": {
        # Open5GS SMF-01 Info API
        "smf_api": "http://10.94.244.17:9090/pdu-info",

        # S-NSSAI used to identify Slice 1
        "expected_sd": "010203",

        # Configured slice bandwidth
        "required_mbps": 150.0,

        # Project SLA:
        # Minimum acceptable bandwidth = 90%
        "min_bandwidth_mbps": 140.0,

        # Project SLA:
        # Maximum allowed average latency
        "max_latency_ms": 5.0,

        # Project SLA:
        # Maximum allowed packet loss
        "max_packet_loss": 1.0,

        # UPF-01 infrastructure address
        "upf_host": "10.94.244.244",
    },


    "SLICE-2": {
        # Open5GS SMF-02 Info API
        "smf_api": "http://10.94.244.18:9090/pdu-info",

        # S-NSSAI used to identify Slice 2
        "expected_sd": "112233",

        # Configured slice bandwidth
        "required_mbps": 75.0,

        # Project SLA:
        # Minimum acceptable bandwidth = 90%
        "min_bandwidth_mbps": 65.0,

        # Project SLA:
        # Maximum allowed average latency
        "max_latency_ms": 10.0,

        # Project SLA:
        # Maximum allowed packet loss
        "max_packet_loss": 1.0,

        # UPF-02 infrastructure address
        "upf_host": "10.94.244.122",
    },
}


# ============================================================
# SSH COMMAND HELPER
# ============================================================

def ssh(host, command):
    """
    Execute a command remotely using the dedicated
    monitoring SSH key.
    """

    result = subprocess.run(
        [
            "ssh",
            "-i",
            SSH_KEY,
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=5",
            f"{SSH_USER}@{host}",
            command,
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"SSH command failed on {host}:\n"
            f"{result.stderr.strip()}"
        )

    return result.stdout.strip()


# ============================================================
# OPEN5GS SESSION DISCOVERY
# ============================================================

def get_session(config):
    """
    Query the Open5GS Info API and dynamically discover
    the active UE belonging to the configured S-NSSAI.

    IMPORTANT:
    The UE IP is obtained from:

        pdu -> ue -> addr

    It is NOT hard-coded.
    """

    print("Querying Open5GS session information...")

    try:

        with urllib.request.urlopen(
            config["smf_api"],
            timeout=5,
        ) as response:

            data = json.loads(
                response.read().decode()
            )

    except Exception as exc:

        raise RuntimeError(
            f"Unable to query Open5GS Info API "
            f"{config['smf_api']}: {exc}"
        )

    # --------------------------------------------------------
    # Process all Open5GS UE/session records
    # --------------------------------------------------------

    for item in data.get("items", []):

        supi = item.get("supi")

        for pdu in item.get("pdu", []):

            # ------------------------------------------------
            # Read S-NSSAI
            # ------------------------------------------------

            snssai = pdu.get("snssai", {})

            sst = snssai.get("sst")
            sd = str(
                snssai.get("sd", "")
            ).lower()

            # Normalize optional 0x prefix
            if sd.startswith("0x"):
                sd = sd[2:]

            expected_sd = (
                config["expected_sd"]
                .lower()
                .replace("0x", "")
            )

            # ------------------------------------------------
            # Select the correct slice
            # ------------------------------------------------

            if sd != expected_sd:
                continue

            # ------------------------------------------------
            # Only use active PDU sessions
            # ------------------------------------------------

            if pdu.get("pdu_state") != "active":
                continue

            # ------------------------------------------------
            # DYNAMIC UE IP DISCOVERY
            # ------------------------------------------------
            #
            # Open5GS Info API structure:
            #
            # "ue": {
            #     "addr": "10.45.0.x"
            # }
            #
            # The value changes depending on UE allocation.
            # ------------------------------------------------

            ue_info = pdu

            ue_ip = ue_info.get("ipv4")

            if not ue_ip:

                print(
                    f"Warning: active session found for "
                    f"{supi}, but UE address is missing."
                )

                continue

            return {
                "supi": supi,
                "ue_ip": ue_ip,
                "id": item.get("id"),
                "snssai": {
                    "sst": sst,
                    "sd": sd,
                },
                "dnn": pdu.get("dnn"),
                "pdu_state": pdu.get("pdu_state"),
            }

    return None


# ============================================================
# IPERF3 SERVER
# ============================================================

def start_iperf_server(upf_host):
    """
    Start an iperf3 server on the selected UPF.
    """

    command = (
        "pkill -x iperf3 2>/dev/null || true; "
        "nohup iperf3 -s -B "
        f"{upf_host} "
        "> /tmp/5g-iperf3-server.log 2>&1 "
        "</dev/null & echo $!"
    )

    pid = ssh(
        upf_host,
        command
    )

    # Allow the server to bind to TCP/5201.
    time.sleep(1)

    return pid


def stop_iperf_server(upf_host):
    """
    Stop temporary iperf3 server.
    """

    try:

        ssh(
            upf_host,
            "pkill -x iperf3 2>/dev/null || true"
        )

    except Exception:

        # Cleanup should never hide the actual test result.
        pass


# ============================================================
# BANDWIDTH TEST
# ============================================================

def run_iperf_client(ue_ip, upf_host):
    """
    Run UE -> UPF bandwidth test.

    The source IP is dynamically discovered from Open5GS.
    """

    command = (
        f"iperf3 "
        f"-c {upf_host} "
        f"-B {ue_ip} "
        f"-t 10 "
        f"-J"
    )

    output = ssh(
        UERANSIM_HOST,
        command
    )

    try:

        return json.loads(output)

    except json.JSONDecodeError as exc:

        raise RuntimeError(
            "iperf3 did not return valid JSON:\n"
            f"{output}"
        ) from exc


# ============================================================
# LATENCY + PACKET LOSS TEST
# ============================================================

def run_ping_test(ue_ip, upf_host):
    """
    Run a 20-packet ICMP test from the dynamically discovered
    UE address to the corresponding UPF.
    """

    print()
    print("Running 20-packet latency test...")

    command = (
        f"ping "
        f"-4 "
        f"-I {ue_ip} "
        f"-c 20 "
        f"-W 2 "
        f"{upf_host}"
    )

    output = ssh(
        UERANSIM_HOST,
        command
    )

    # --------------------------------------------------------
    # Extract packet loss
    #
    # Example:
    # 20 packets transmitted, 20 received, 0% packet loss
    # --------------------------------------------------------

    loss_match = re.search(
        r"(\d+(?:\.\d+)?)%\s*packet loss",
        output,
    )

    if not loss_match:

        raise RuntimeError(
            "Could not determine packet loss "
            "from ping output."
        )

    packet_loss = float(
        loss_match.group(1)
    )

    # --------------------------------------------------------
    # Extract RTT statistics
    #
    # Example:
    #
    # rtt min/avg/max/mdev =
    # 1.545/6.654/25.156/5.575 ms
    # --------------------------------------------------------

    rtt_match = re.search(
        r"=\s*"
        r"([\d.]+)/"
        r"([\d.]+)/"
        r"([\d.]+)/"
        r"([\d.]+)\s*ms",
        output,
    )

    if not rtt_match:

        raise RuntimeError(
            "Could not determine RTT statistics "
            "from ping output."
        )

    min_latency = float(
        rtt_match.group(1)
    )

    avg_latency = float(
        rtt_match.group(2)
    )

    max_latency = float(
        rtt_match.group(3)
    )

    mdev = float(
        rtt_match.group(4)
    )

    return {
        "packet_loss": packet_loss,
        "min_latency": min_latency,
        "avg_latency": avg_latency,
        "max_latency": max_latency,
        "mdev": mdev,
        "raw_output": output,
    }


# ============================================================
# SLA EVALUATION
# ============================================================

def evaluate_sla(
    config,
    measured_mbps,
    latency,
):
    """
    Evaluate all project SLA conditions.
    """

    # --------------------------------------------------------
    # Bandwidth
    # --------------------------------------------------------

    bandwidth_ok = (
        measured_mbps
        >= config["min_bandwidth_mbps"]
    )

    # --------------------------------------------------------
    # Average latency
    # --------------------------------------------------------

    latency_ok = (
        latency["avg_latency"]
        <= config["max_latency_ms"]
    )

    # --------------------------------------------------------
    # Packet loss
    # --------------------------------------------------------

    packet_loss_ok = (
        latency["packet_loss"]
        <= config["max_packet_loss"]
    )

    # --------------------------------------------------------
    # Overall SLA
    # --------------------------------------------------------

    overall_compliant = (
        bandwidth_ok
        and latency_ok
        and packet_loss_ok
    )

    return {
        "bandwidth_ok": bandwidth_ok,
        "latency_ok": latency_ok,
        "packet_loss_ok": packet_loss_ok,
        "overall_compliant": overall_compliant,
    }


# ============================================================
# SLICE MEASUREMENT
# ============================================================

def measure_slice(slice_name, config):

    print()
    print("=" * 72)
    print(f"{slice_name} SLA TEST")
    print("=" * 72)

    # --------------------------------------------------------
    # SLA configuration
    # --------------------------------------------------------

    print(
        f"Configured bandwidth : "
        f"{config['required_mbps']:.2f} Mbps"
    )

    print(
        f"Minimum SLA bandwidth: "
        f"{config['min_bandwidth_mbps']:.2f} Mbps"
    )

    print(
        f"Maximum avg latency  : "
        f"{config['max_latency_ms']:.2f} ms"
    )

    print(
        f"Maximum packet loss  : "
        f"{config['max_packet_loss']:.2f}%"
    )

    print(
        f"UPF                   : "
        f"{config['upf_host']}"
    )

    # ========================================================
    # DYNAMIC OPEN5GS SESSION DISCOVERY
    # ========================================================

    print()
    print("-" * 72)
    print("Discovering actual active UE from Open5GS...")
    print("-" * 72)

    session = get_session(config)

    if not session:

        print()
        print(
            "STATUS               : "
            "NO ACTIVE UE SESSION"
        )

        return None

    # --------------------------------------------------------
    # Dynamically discovered values
    # --------------------------------------------------------

    ue_ip = session["ue_ip"]

    print()
    print(
        f"SUPI                 : "
        f"{session['supi']}"
    )

    print(
        f"UE IP                : "
        f"{ue_ip}"
    )

    print(
        f"S-NSSAI              : "
        f"SST={session['snssai']['sst']} "
        f"SD={session['snssai']['sd']}"
    )

    print(
        f"DNN                  : "
        f"{session['dnn']}"
    )

    print(
        f"PDU state            : "
        f"{session['pdu_state']}"
    )

    print(
        f"UPF                   : "
        f"{config['upf_host']}"
    )

    # ========================================================
    # START IPERF3 SERVER
    # ========================================================

    print()
    print("-" * 72)
    print("Starting iperf3 server on actual UPF...")
    print("-" * 72)

    start_iperf_server(
        config["upf_host"]
    )

    try:

        # ====================================================
        # BANDWIDTH MEASUREMENT
        # ====================================================

        print()
        print(
            "Running 10-second UE -> UPF "
            "bandwidth measurement..."
        )

        result = run_iperf_client(
            ue_ip,
            config["upf_host"]
        )

        end = result.get(
            "end",
            {}
        )

        receiver = end.get(
            "sum_received",
            {}
        )

        measured_mbps = (
            receiver.get(
                "bits_per_second",
                0,
            )
            / 1_000_000
        )

        print()
        print(
            f"Measured bandwidth  : "
            f"{measured_mbps:.2f} Mbps"
        )

        # ====================================================
        # LATENCY + PACKET LOSS
        # ====================================================

        latency = run_ping_test(
            ue_ip,
            config["upf_host"]
        )

        print()
        print(
            f"Average latency     : "
            f"{latency['avg_latency']:.3f} ms"
        )

        print(
            f"Maximum latency     : "
            f"{latency['max_latency']:.3f} ms"
        )

        print(
            f"Jitter / mdev       : "
            f"{latency['mdev']:.3f} ms"
        )

        print(
            f"Packet loss         : "
            f"{latency['packet_loss']:.2f}%"
        )

        # ====================================================
        # SLA EVALUATION
        # ====================================================

        sla = evaluate_sla(
            config,
            measured_mbps,
            latency,
        )

        # ====================================================
        # HUMAN-READABLE RESULT
        # ====================================================

        print()
        print("=" * 72)
        print(f"{slice_name} SLA RESULT")
        print("=" * 72)

        # ----------------------------------------------------
        # Bandwidth
        # ----------------------------------------------------

        print()
        print("Bandwidth:")

        print(
            f"  Configured          : "
            f"{config['required_mbps']:.2f} Mbps"
        )

        print(
            f"  Minimum SLA         : "
            f"{config['min_bandwidth_mbps']:.2f} Mbps"
        )

        print(
            f"  Measured            : "
            f"{measured_mbps:.2f} Mbps"
        )

        print(
            f"  Status              : "
            f"{'COMPLIANT' if sla['bandwidth_ok'] else 'VIOLATION'}"
        )

        # ----------------------------------------------------
        # Latency
        # ----------------------------------------------------

        print()
        print("Latency:")

        print(
            f"  Maximum allowed avg : "
            f"{config['max_latency_ms']:.2f} ms"
        )

        print(
            f"  Measured avg        : "
            f"{latency['avg_latency']:.3f} ms"
        )

        print(
            f"  Status              : "
            f"{'COMPLIANT' if sla['latency_ok'] else 'VIOLATION'}"
        )

        # ----------------------------------------------------
        # Packet loss
        # ----------------------------------------------------

        print()
        print("Packet Loss:")

        print(
            f"  Maximum allowed     : "
            f"{config['max_packet_loss']:.2f}%"
        )

        print(
            f"  Measured            : "
            f"{latency['packet_loss']:.2f}%"
        )

        print(
            f"  Status              : "
            f"{'COMPLIANT' if sla['packet_loss_ok'] else 'VIOLATION'}"
        )

        # ----------------------------------------------------
        # Overall
        # ----------------------------------------------------

        print()
        print("-" * 72)

        print(
            f"OVERALL SLA          : "
            f"{'COMPLIANT' if sla['overall_compliant'] else 'VIOLATION'}"
        )

        print("-" * 72)

        # ====================================================
        # MACHINE-READABLE RESULT
        # ====================================================
        #
        # This object will be used later by the Ethereum
        # integration.
        #
        # ====================================================

        sla_result = {

            "slice": slice_name,

            "supi": session["supi"],

            # Dynamically discovered UE IP
            "ue_ip": ue_ip,

            "upf_ip": config["upf_host"],

            "snssai": session["snssai"],

            "dnn": session["dnn"],

            "bandwidth": {

                "configured_mbps":
                    config["required_mbps"],

                "minimum_mbps":
                    config["min_bandwidth_mbps"],

                "measured_mbps":
                    round(
                        measured_mbps,
                        3,
                    ),

                "compliant":
                    sla["bandwidth_ok"],
            },

            "latency": {

                "maximum_average_ms":
                    config["max_latency_ms"],

                "measured_average_ms":
                    round(
                        latency["avg_latency"],
                        3,
                    ),

                "maximum_observed_ms":
                    round(
                        latency["max_latency"],
                        3,
                    ),

                "jitter_mdev_ms":
                    round(
                        latency["mdev"],
                        3,
                    ),

                "compliant":
                    sla["latency_ok"],
            },

            "packet_loss": {

                "maximum_percent":
                    config["max_packet_loss"],

                "measured_percent":
                    latency["packet_loss"],

                "compliant":
                    sla["packet_loss_ok"],
            },

            "overall_compliant":
                sla["overall_compliant"],
        }

        print()
        print("Machine-readable SLA result:")
        print(
            json.dumps(
                sla_result,
                indent=2,
            )
        )

        return sla_result

    finally:

        # ====================================================
        # CLEANUP
        # ====================================================

        print()
        print("Stopping iperf3 server...")

        stop_iperf_server(
            config["upf_host"]
        )


# ============================================================
# MAIN
# ============================================================

def main():

    print("=" * 72)
    print("5G SLA MONITOR")
    print("Real Open5GS Session -> UE -> UPF Measurement")
    print("=" * 72)

    print()
    print("PROJECT SLA POLICY")
    print("-" * 72)
    print(
        "Bandwidth   : Slice 1 >= 140 Mbps | Slice 2 >= 65 Mbps"
    )
    print(
        "Slice 1     : Average latency <= 5 ms"
    )
    print(
        "Slice 2     : Average latency <= 10 ms"
    )
    print(
        "Packet loss : <= 1%"
    )
    print("-" * 72)

    # ========================================================
    # SLICE 1
    # ========================================================

    measure_slice(
        "SLICE-1",
        SLICES["SLICE-1"],
    )

    # ========================================================
    # SLICE 2
    # ========================================================

    measure_slice(
        "SLICE-2",
        SLICES["SLICE-2"],
    )


# ============================================================
# PROGRAM ENTRY
# ============================================================

if __name__ == "__main__":

    try:

        main()

    except KeyboardInterrupt:

        print()
        print("Test interrupted.")

        sys.exit(1)

    except Exception as exc:

        print()
        print("ERROR:")
        print(exc)

        sys.exit(1)
