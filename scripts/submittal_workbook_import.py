#!/usr/bin/env python3
"""
Import workbook-derived agency/permit/item catalogs into Supabase with preview mode.

Default mode is preview only:
  python scripts/submittal_workbook_import.py --workbook "z:\\Shared\\Standards\\Submittal Manager\\Submittal Manager.xlsm"

Apply changes:
  python scripts/submittal_workbook_import.py --workbook "z:\\Shared\\Standards\\Submittal Manager\\Submittal Manager.xlsm" --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple


def load_env(env_path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}
    if not env_path.exists():
        return values
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        values[k.strip()] = v.strip().strip('"').strip("'")
    return values


def slugify(text: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "_", text.strip().lower()).strip("_") or "value"


def canonical_marker_key(item_name: str) -> str:
    upper = item_name.strip().upper().rstrip(":")
    if upper.startswith("PHASE "):
        return "special_marker:PHASE"
    return f"special_marker:{upper}"


def decide_action(row: Dict[str, Any], decisions: Dict[str, Any]) -> str:
    overrides = (
        decisions.get("agency_overrides", {})
        .get(row.get("agency_code", ""), {})
        .get(row.get("permit_name", ""), {})
    )
    row_key = f"{row.get('row_number')}::{row.get('item_name', '').strip()}"
    if row_key in overrides:
        return overrides[row_key]

    if row.get("flag_type") == "repeated_header":
        return decisions.get("default_actions", {}).get("repeated_header", "pending_review")

    if row.get("flag_type") == "special_marker":
        marker_key = canonical_marker_key(row.get("item_name", ""))
        return decisions.get("default_actions", {}).get(marker_key, "pending_review")

    return "required_item"


class SupabaseRest:
    def __init__(self, base_url: str, service_role_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.key = service_role_key

    def _request(
        self,
        method: str,
        path: str,
        query: Dict[str, str] | None = None,
        body: Any | None = None,
        prefer: str | None = None,
    ) -> Any:
        url = f"{self.base_url}/rest/v1/{path}"
        if query:
            url += "?" + urllib.parse.urlencode(query)
        data = None
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
        }
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer
        req = urllib.request.Request(url=url, method=method, data=data, headers=headers)
        try:
            with urllib.request.urlopen(req) as resp:
                payload = resp.read().decode("utf-8")
                return json.loads(payload) if payload else []
        except urllib.error.HTTPError as exc:
            details = ""
            try:
                details = exc.read().decode("utf-8")
            except Exception:
                details = ""
            raise RuntimeError(f"Supabase REST error {exc.code} on {path}: {details}") from exc

    def select(self, table: str, select: str) -> List[Dict[str, Any]]:
        return self._request("GET", table, query={"select": select}) or []

    def upsert(self, table: str, rows: List[Dict[str, Any]], on_conflict: str) -> List[Dict[str, Any]]:
        if not rows:
            return []
        return self._request(
            "POST",
            table,
            query={"on_conflict": on_conflict},
            body=rows,
            prefer="resolution=merge-duplicates,return=representation",
        ) or []

    def update_by_id_upsert(self, table: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        updated: List[Dict[str, Any]] = []
        for row in rows:
            row_id = row.get("id")
            if row_id is None:
                continue
            patch_payload = {k: v for k, v in row.items() if k != "id"}
            result = self._request(
                "PATCH",
                table,
                query={"id": f"eq.{row_id}"},
                body=patch_payload,
                prefer="return=representation",
            )
            if isinstance(result, list):
                updated.extend(result)
        return updated

    def insert(self, table: str, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not rows:
            return []
        return self._request("POST", table, body=rows, prefer="return=representation") or []


def run_parser(workbook: Path, out_json: Path, out_md: Path) -> None:
    cmd = [
        sys.executable,
        "scripts/submittal_workbook_parser.py",
        "--workbook",
        str(workbook),
        "--out-json",
        str(out_json),
        "--out-md",
        str(out_md),
    ]
    subprocess.run(cmd, check=True)


def build_import_rows(parsed: Dict[str, Any], decisions: Dict[str, Any]) -> Dict[str, Any]:
    agencies = []
    permits = []
    items = []
    flagged_summary: Dict[str, int] = defaultdict(int)

    permit_seen = set()
    for agency_idx, agency in enumerate(parsed.get("agencies", []), start=1):
        agencies.append(
            {
                "code": agency["agency_code"],
                "name": agency["agency_name"],
                "is_active": True,
                "sort_order": agency_idx,
            }
        )

        for permit_idx, permit in enumerate(agency.get("permits", []), start=1):
            key = (agency["agency_code"], permit["permit_name"])
            if key in permit_seen:
                continue
            permit_seen.add(key)
            permits.append(
                {
                    "agency_code": agency["agency_code"],
                    "permit_name": permit["permit_name"],
                    "permit_code": permit["permit_code"],
                    "description": f"Imported from workbook {agency['agency_code']}",
                    "sort_order": permit_idx,
                }
            )

        for row in agency.get("items", []):
            items.append(
                {
                    "agency_code": row["agency_code"],
                    "permit_name": row["permit_name"],
                    "item_name": row["item_name"],
                    "item_code": row["item_code"],
                    "item_type": row["item_type_guess"] or "document",
                    "responsibility": "provided",
                    "default_required": True,
                    "default_notes": None,
                    "source_row": row["row_number"],
                }
            )

        for flagged in agency.get("flagged_rows", []):
            action = decide_action(flagged, decisions)
            flagged_summary[action] += 1
            if action == "required_item":
                items.append(
                    {
                        "agency_code": flagged["agency_code"],
                        "permit_name": flagged["permit_name"],
                        "item_name": flagged["item_name"],
                        "item_code": flagged["item_code"],
                        "item_type": flagged.get("item_type_guess") or "document",
                        "responsibility": "provided",
                        "default_required": True,
                        "default_notes": f"Flagged row imported: {flagged.get('flag_type')}",
                        "source_row": flagged["row_number"],
                    }
                )
            elif action == "note":
                items.append(
                    {
                        "agency_code": flagged["agency_code"],
                        "permit_name": flagged["permit_name"],
                        "item_name": flagged["item_name"],
                        "item_code": f"NOTE_{slugify(flagged['item_name']).upper()}",
                        "item_type": "other",
                        "responsibility": "shared",
                        "default_required": False,
                        "default_notes": f"Workbook note marker ({flagged.get('flag_type')})",
                        "source_row": flagged["row_number"],
                    }
                )

    deduped_items = {}
    for item in items:
        key = (item["agency_code"], item["permit_name"], item["item_code"], item["item_name"])
        deduped_items[key] = item

    return {
        "agencies": agencies,
        "permits": permits,
        "items": list(deduped_items.values()),
        "flagged_summary": dict(flagged_summary),
    }


def materialize_project_required_items(client: SupabaseRest) -> Dict[str, int]:
    selections = client.select(
        "project_permit_selections",
        "id,project_id,permit_id,is_selected",
    )
    selections = [x for x in selections if x.get("is_selected")]
    if not selections:
        return {"inserted": 0, "checked": 0}

    catalog_items = client.select(
        "permit_required_item_catalog",
        "id,permit_id,code,name,item_type,responsibility,default_required,is_active",
    )
    by_permit: Dict[int, List[Dict[str, Any]]] = defaultdict(list)
    for item in catalog_items:
        if item.get("is_active"):
            by_permit[item["permit_id"]].append(item)

    existing = client.select(
        "project_required_items",
        "project_permit_selection_id,code,name",
    )
    existing_keys = {
        (
            row.get("project_permit_selection_id"),
            (row.get("code") or "").strip().upper(),
            (row.get("name") or "").strip().upper(),
        )
        for row in existing
    }

    inserts: List[Dict[str, Any]] = []
    for selection in selections:
        for c in by_permit.get(selection["permit_id"], []):
            key = (
                selection["id"],
                (c.get("code") or "").strip().upper(),
                (c.get("name") or "").strip().upper(),
            )
            if key in existing_keys:
                continue
            inserts.append(
                {
                    "project_id": selection["project_id"],
                    "project_permit_selection_id": selection["id"],
                    "required_item_catalog_id": c["id"],
                    "code": c.get("code"),
                    "name": c.get("name"),
                    "item_type": c.get("item_type") or "document",
                    "responsibility": c.get("responsibility") or "provided",
                    "is_required": bool(c.get("default_required", True)),
                    "status": "pending",
                }
            )
            existing_keys.add(key)

    client.insert("project_required_items", inserts)
    return {"inserted": len(inserts), "checked": len(selections)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", required=True)
    parser.add_argument(
        "--dry-run-json",
        default="scripts/submittal_workbook_dry_run.json",
    )
    parser.add_argument(
        "--dry-run-md",
        default="scripts/submittal_workbook_dry_run.md",
    )
    parser.add_argument(
        "--decisions",
        default="scripts/submittal-workbook-decisions.json",
    )
    parser.add_argument("--preview", action="store_true", default=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--materialize-project-items", action="store_true")
    args = parser.parse_args()

    workbook = Path(args.workbook)
    out_json = Path(args.dry_run_json)
    out_md = Path(args.dry_run_md)
    decisions_path = Path(args.decisions)

    run_parser(workbook, out_json, out_md)
    parsed = json.loads(out_json.read_text(encoding="utf-8"))
    decisions = json.loads(decisions_path.read_text(encoding="utf-8"))
    import_rows = build_import_rows(parsed, decisions)

    summary: Dict[str, Any] = {
        "mode": "preview" if not args.apply else "apply",
        "workbook": str(workbook),
        "prepared": {
            "agencies": len(import_rows["agencies"]),
            "permits": len(import_rows["permits"]),
            "items": len(import_rows["items"]),
        },
        "flagged_summary": import_rows["flagged_summary"],
    }

    if not args.apply:
        print(json.dumps(summary, indent=2))
        return

    env_values = load_env(Path(".env.local"))
    base_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or env_values.get("NEXT_PUBLIC_SUPABASE_URL")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or env_values.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_role:
        raise RuntimeError("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    client = SupabaseRest(base_url=base_url, service_role_key=service_role)

    agencies_upserted = client.upsert("agency_catalog", import_rows["agencies"], "code")
    agency_rows = client.select("agency_catalog", "id,code,name")
    agency_id_by_code = {row["code"]: row["id"] for row in agency_rows}

    permit_payload = []
    for p in import_rows["permits"]:
        agency_id = agency_id_by_code.get(p["agency_code"])
        if not agency_id:
            continue
        permit_payload.append(
            {
                "agency_id": agency_id,
                "code": p["permit_code"],
                "name": p["permit_name"],
                "description": p["description"],
                "is_active": True,
                "sort_order": p["sort_order"],
            }
        )
    permits_upserted = client.upsert("permit_catalog", permit_payload, "agency_id,code")
    permit_rows = client.select("permit_catalog", "id,agency_id,code,name,description,is_active")
    permit_id_by_agency_and_name = {
        (row["agency_id"], row["name"]): row["id"] for row in permit_rows
    }
    imported_permit_codes_by_agency: Dict[int, set] = defaultdict(set)
    for row in permit_payload:
        imported_permit_codes_by_agency[int(row["agency_id"])].add(str(row["code"]).strip().upper())

    stale_permit_updates: List[Dict[str, Any]] = []
    for row in permit_rows:
        agency_id = int(row["agency_id"])
        imported_codes = imported_permit_codes_by_agency.get(agency_id)
        if not imported_codes:
            continue
        code = str(row["code"]).strip().upper()
        description = str(row.get("description") or "")
        if description.startswith("Imported from workbook") and code not in imported_codes and bool(row.get("is_active", True)):
            stale_permit_updates.append({"id": row["id"], "is_active": False})
    client.update_by_id_upsert("permit_catalog", stale_permit_updates)

    item_payload = []
    for i, item in enumerate(import_rows["items"], start=1):
        agency_id = agency_id_by_code.get(item["agency_code"])
        if not agency_id:
            continue
        permit_id = permit_id_by_agency_and_name.get((agency_id, item["permit_name"]))
        if not permit_id:
            continue
        item_payload.append(
            {
                "permit_id": permit_id,
                "code": item["item_code"],
                "name": item["item_name"],
                "item_type": item["item_type"],
                "responsibility": item["responsibility"],
                "default_required": item["default_required"],
                "default_notes": item["default_notes"],
                "sort_order": i,
                "is_active": True,
            }
        )
    deduped_item_payload: Dict[Tuple[int, str], Dict[str, Any]] = {}
    for row in item_payload:
        key = (int(row["permit_id"]), str(row["code"]).strip().upper())
        deduped_item_payload[key] = row
    items_upserted = client.upsert(
        "permit_required_item_catalog",
        list(deduped_item_payload.values()),
        "permit_id,code",
    )

    imported_item_codes_by_permit: Dict[int, set] = defaultdict(set)
    for row in deduped_item_payload.values():
        imported_item_codes_by_permit[int(row["permit_id"])].add(str(row["code"]).strip().upper())

    existing_items = client.select(
        "permit_required_item_catalog",
        "id,permit_id,code,is_active",
    )
    stale_item_updates: List[Dict[str, Any]] = []
    for row in existing_items:
        permit_id = int(row["permit_id"])
        imported_codes = imported_item_codes_by_permit.get(permit_id)
        if not imported_codes:
            continue
        code = str(row["code"]).strip().upper()
        if code not in imported_codes and bool(row.get("is_active", True)):
            stale_item_updates.append({"id": row["id"], "is_active": False})
    client.update_by_id_upsert("permit_required_item_catalog", stale_item_updates)

    materialized = {"inserted": 0, "checked": 0}
    if args.materialize_project_items:
        materialized = materialize_project_required_items(client)

    summary["applied"] = {
        "agencies_upserted": len(agencies_upserted),
        "permits_upserted": len(permits_upserted),
        "items_upserted": len(items_upserted),
        "permits_deactivated": len(stale_permit_updates),
        "items_deactivated": len(stale_item_updates),
        "materialized_project_required_items": materialized,
    }

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
