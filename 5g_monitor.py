#!/usr/bin/env python3

import json
import urllib.request
import urllib.error
from datetime import datetime

# ------------------------------------------------------------
# Open5GS SMF endpoints
# ------------------------------------------------------------

SMFS = {
    "SLICE-1": {
        "smf": "SMF-01",
        "address": "http://10.94.244.17:9090/pdu-info",
        "sst": 1,
        "sd": "010203",
        "expected_subnet": "10.45.0.0/16",
        "upf": "UPF-01",
        "upf_ip": "10.94.244.244",
        "required_bandwidth_mbps": 150,
    },
    "SLICE-2": {
        "smf": "SMF-02",
        "address": "http://10.94.244.18:9090/pdu-info",
        "sst": 1,
        "sd": "112233",
        "expected_subnet": "10.46.0.0/16",
        "upf": "UPF-02",
        "upf_ip": "10.94.244.122",
        "required_bandwidth_mbps": 75,
    },
}


def query_open5gs(url):
    """Query an Open5GS Info API endpoint."""
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return json.loads(response.read().decode())

    except urllib.error.URLError as exc:
        return {
            "error": f"Connection failed: {exc}"
        }

    except Exception as exc:
        return {
            "error": str(exc)
        }


def discover_slice(slice_name, config):
    """Discover active UE/PDU sessions for one slice."""

    data = query_open5gs(config["address"])

    if "error" in data:
        return {
            "slice": slice_name,
            "status": "ERROR",
            "error": data["error"],
        }

    sessions = []

    for item in data.get("items", []):

        supi = item.get("supi", "unknown")

        for pdu in item.get("pdu", []):

            snssai = pdu.get("snssai", {})

            session = {
                "slice": slice_name,
                "smf": config["smf"],
                "supi": supi,
                "psi": pdu.get("psi"),
                "dnn": pdu.get("dnn"),
                "ue_ip": pdu.get("ipv4"),
                "sst": snssai.get("sst"),
                "sd": snssai.get("sd"),
                "pdu_state": pdu.get("pdu_state"),
                "ue_activity": item.get("ue_activity"),
                "upf": config["upf"],
                "upf_ip": config["upf_ip"],
                "required_bandwidth_mbps":
                    config["required_bandwidth_mbps"],
                "qos_flows": pdu.get("qos_flows", []),
                "n3": pdu.get("n3", {}),
            }

            sessions.append(session)

    return {
        "slice": slice_name,
        "status": "ACTIVE" if sessions else "NO_SESSION",
        "sessions": sessions,
    }


def print_session(session):

    print(f"  UE/SUPI       : {session['supi']}")
    print(f"  UE IPv4       : {session['ue_ip']}")
    print(f"  SST           : {session['sst']}")
    print(f"  SD            : {session['sd']}")
    print(f"  DNN           : {session['dnn']}")
    print(f"  PDU State     : {session['pdu_state']}")
    print(f"  UE Activity   : {session['ue_activity']}")
    print(f"  SMF           : {session['smf']}")
    print(f"  UPF           : {session['upf']}")
    print(f"  UPF IP        : {session['upf_ip']}")
    print(
        f"  Required BW   : "
        f"{session['required_bandwidth_mbps']} Mbps"
    )

    if session["qos_flows"]:
        for flow in session["qos_flows"]:
            print(
                f"  QoS           : "
                f"QFI={flow.get('qfi')} "
                f"5QI={flow.get('5qi')}"
            )


def main():

    print("=" * 72)
    print("5G NETWORK SLICE MONITOR")
    print("Open5GS Real-Time Session Discovery")
    print("=" * 72)

    print(
        "Timestamp:",
        datetime.now().astimezone().isoformat()
    )

    print()

    results = []

    for slice_name, config in SMFS.items():

        print("-" * 72)
        print(
            f"{slice_name} | "
            f"{config['smf']} | "
            f"SST={config['sst']} SD={config['sd']}"
        )
        print("-" * 72)

        result = discover_slice(slice_name, config)
        results.append(result)

        if result["status"] == "ERROR":

            print("STATUS        : ERROR")
            print("ERROR         :", result["error"])

        elif result["status"] == "NO_SESSION":

            print("STATUS        : NO ACTIVE SESSION")

        else:

            print(
                f"STATUS        : ACTIVE "
                f"({len(result['sessions'])} session(s))"
            )

            for session in result["sessions"]:
                print()
                print_session(session)

        print()

    print("=" * 72)
    print("MONITOR SUMMARY")
    print("=" * 72)

    for result in results:

        if result["status"] == "ACTIVE":
            print(
                f"{result['slice']}: "
                f"ACTIVE - "
                f"{len(result['sessions'])} session(s)"
            )

        elif result["status"] == "NO_SESSION":
            print(
                f"{result['slice']}: "
                f"NO ACTIVE SESSION"
            )

        else:
            print(
                f"{result['slice']}: "
                f"ERROR"
            )

    print("=" * 72)


if __name__ == "__main__":
    main()
