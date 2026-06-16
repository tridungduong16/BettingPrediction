from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from app.connectors.worldcup.openfootball import OpenFootballWorldCupConnector
from app.core.app_config import get_app_config
from app.services.worldcup_service import FileWorldCupCacheRepository, WorldCupService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scrape World Cup data into the local cache.")
    parser.add_argument("--year", type=int, default=None, help="Tournament year, e.g. 2026.")
    parser.add_argument(
        "--source",
        choices=["auto", "upbound", "openfootball"],
        default="auto",
        help="Data source to fetch.",
    )
    parser.add_argument("--force", action="store_true", help="Bypass cache TTL.")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Optional normalized JSON output path.",
    )
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    config = get_app_config()
    service = WorldCupService(
        config=config,
        connector=OpenFootballWorldCupConnector(config=config),
        cache=FileWorldCupCacheRepository(data_dir=config.worldcup_data_dir),
    )

    dataset = await service.get_dataset(
        year=args.year,
        source=args.source,
        force_refresh=args.force,
    )

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(dataset.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    print(
        json.dumps(
            {
                "name": dataset.source.name,
                "year": dataset.source.year,
                "source": dataset.source.source_name,
                "source_url": dataset.source.source_url,
                "fetched_at": dataset.source.fetched_at.isoformat(),
                "cache_hit": dataset.source.cache_hit,
                "stale_cache": dataset.source.stale_cache,
                "match_count": dataset.source.match_count,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())

