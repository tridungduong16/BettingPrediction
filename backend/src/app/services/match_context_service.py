from __future__ import annotations

import re
from typing import Any

from app.models.live_events import LiveMatchEvent, LiveMatchSnapshot
from app.models.market_prediction import PredictionMode, ResponseLanguage
from app.models.worldcup import WorldCupMatch

LIVE_PREDICTION_PHASES = {
    "first_half",
    "halftime",
    "second_half",
    "extra_time",
    "penalties",
    "suspended",
}

STAT_KEY_ALIASES = {
    "shots_on_goal": "shots_on_goal",
    "shots_off_goal": "shots_off_goal",
    "total_shots": "total_shots",
    "blocked_shots": "blocked_shots",
    "shots_insidebox": "shots_inside_box",
    "shots_outsidebox": "shots_outside_box",
    "fouls": "fouls",
    "corner_kicks": "corners",
    "offsides": "offsides",
    "ball_possession": "possession_pct",
    "yellow_cards": "yellow_cards",
    "red_cards": "red_cards",
    "goalkeeper_saves": "goalkeeper_saves",
    "total_passes": "total_passes",
    "passes_accurate": "passes_accurate",
    "passes_pct": "passes_pct",
}


class MatchContextService:
    def build_market_prediction_context(
        self,
        *,
        match: WorldCupMatch,
        live_snapshot: LiveMatchSnapshot | None,
        prediction_mode: PredictionMode,
        language: ResponseLanguage = "vi",
        news_context: dict[str, Any] | None = None,
        user_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        data_quality = self._data_quality(
            live_snapshot=live_snapshot,
            prediction_mode=prediction_mode,
        )
        self._apply_news_quality(data_quality, news_context)
        return {
            "language": language,
            "prediction_mode": prediction_mode,
            "match": self._match_context(match, prediction_mode=prediction_mode),
            "teams": self._teams_context(match, live_snapshot),
            "live": self._live_context(live_snapshot, prediction_mode=prediction_mode),
            "news": news_context,
            "actual_result": self._actual_result(match)
            if prediction_mode == "post_match_evaluation"
            else None,
            "data_quality": data_quality,
            "user_context": user_context or {},
        }

    def _match_context(
        self,
        match: WorldCupMatch,
        *,
        prediction_mode: PredictionMode,
    ) -> dict[str, Any]:
        status = match.status
        if prediction_mode == "pre_match":
            status = "scheduled"
        elif prediction_mode == "live":
            status = "live"

        return {
            "id": match.id,
            "competition": match.competition,
            "round": match.round,
            "date": match.date,
            "time": match.time,
            "kickoff_utc": match.kickoff_utc.isoformat() if match.kickoff_utc else None,
            "home_team": match.team1,
            "away_team": match.team2,
            "group": match.group,
            "venue": match.ground,
            "city": match.city,
            "status_for_prediction": status,
        }

    def _teams_context(
        self,
        match: WorldCupMatch,
        live_snapshot: LiveMatchSnapshot | None,
    ) -> dict[str, Any]:
        provider_ids = self._provider_team_ids(live_snapshot)
        live_statistics = self._live_statistics_by_side(live_snapshot)
        return {
            "home": {
                "name": match.team1,
                "side": "home",
                "provider_team_id": provider_ids.get("home"),
                "live_statistics": live_statistics.get("home", {}),
            },
            "away": {
                "name": match.team2,
                "side": "away",
                "provider_team_id": provider_ids.get("away"),
                "live_statistics": live_statistics.get("away", {}),
            },
        }

    def _live_context(
        self,
        live_snapshot: LiveMatchSnapshot | None,
        *,
        prediction_mode: PredictionMode,
    ) -> dict[str, Any] | None:
        if prediction_mode == "pre_match" or live_snapshot is None:
            return None

        clock_phase = live_snapshot.clock.phase
        if prediction_mode == "live" and clock_phase not in LIVE_PREDICTION_PHASES:
            return None

        return {
            "provider": live_snapshot.provider,
            "provider_fixture_id": live_snapshot.provider_fixture_id,
            "provider_status": live_snapshot.provider_status,
            "observed_at": live_snapshot.observed_at.isoformat(),
            "score": live_snapshot.score.model_dump(mode="json", exclude_none=True),
            "clock": live_snapshot.clock.model_dump(mode="json", exclude_none=True),
            "events": [self._event_context(event) for event in live_snapshot.events],
            "statistics": self._live_statistics_by_side(live_snapshot),
        }

    @staticmethod
    def _actual_result(match: WorldCupMatch) -> dict[str, Any] | None:
        if match.score is None:
            return None
        return {
            "score": match.score.model_dump(mode="json", exclude_none=True),
            "winner": match.winner,
            "home_goals": [
                goal.model_dump(mode="json", exclude_none=True) for goal in match.goals1
            ],
            "away_goals": [
                goal.model_dump(mode="json", exclude_none=True) for goal in match.goals2
            ],
        }

    @staticmethod
    def _event_context(event: LiveMatchEvent) -> dict[str, Any]:
        return {
            "type": event.type,
            "detail": event.detail,
            "comments": event.comments,
            "minute": event.minute,
            "stoppage_minute": event.stoppage_minute,
            "team_side": event.team.side,
            "team_name": event.team.name,
            "player": event.player.name if event.player else None,
            "assist_player": event.assist_player.name if event.assist_player else None,
            "score": event.score.model_dump(mode="json", exclude_none=True)
            if event.score
            else None,
        }

    def _data_quality(
        self,
        *,
        live_snapshot: LiveMatchSnapshot | None,
        prediction_mode: PredictionMode,
    ) -> dict[str, Any]:
        sources = ["worldcup_fixture"]
        missing = [
            "odds movement",
            "confirmed lineups",
            "injury/suspension report",
            "referee profile",
            "weather",
            "recent team form",
        ]
        notes: list[str] = []

        if live_snapshot is None:
            missing.extend(["live score", "live events", "live team statistics"])
        else:
            sources.append(live_snapshot.provider)
            if live_snapshot.provider_status != "ready":
                missing.extend(["live score", "live events", "live team statistics"])
                if live_snapshot.error:
                    notes.append(live_snapshot.error)
            elif not self._live_statistics_by_side(live_snapshot):
                missing.append("live team statistics")

            if (
                prediction_mode == "live"
                and live_snapshot.clock.phase not in LIVE_PREDICTION_PHASES
            ):
                notes.append(
                    "Live snapshot is not in an in-play phase; live score/events excluded."
                )

        if prediction_mode == "pre_match":
            notes.append("Final score, winner and goal events are excluded from the LLM context.")

        return {
            "sources": sources,
            "missing": sorted(set(missing)),
            "notes": notes,
        }

    @staticmethod
    def _apply_news_quality(
        data_quality: dict[str, Any],
        news_context: dict[str, Any] | None,
    ) -> None:
        if news_context is None:
            data_quality["missing"] = sorted(
                set(data_quality.get("missing", [])) | {"news/search context"}
            )
            return

        if (
            news_context.get("provider_status") == "ready"
            and len(news_context.get("results", [])) > 0
        ):
            data_quality["sources"] = list(
                dict.fromkeys([*data_quality.get("sources", []), "perplexity_search"])
            )
            return

        data_quality["missing"] = sorted(
            set(data_quality.get("missing", [])) | {"news/search context"}
        )
        error = news_context.get("error")
        if error:
            data_quality.setdefault("notes", []).append(str(error))

    @staticmethod
    def _provider_team_ids(live_snapshot: LiveMatchSnapshot | None) -> dict[str, str | None]:
        if live_snapshot is None:
            return {"home": None, "away": None}
        fixture = live_snapshot.raw.get("fixture")
        if not isinstance(fixture, dict):
            return {"home": None, "away": None}
        return {
            "home": _nested_str(fixture, "teams", "home", "id"),
            "away": _nested_str(fixture, "teams", "away", "id"),
        }

    def _live_statistics_by_side(
        self,
        live_snapshot: LiveMatchSnapshot | None,
    ) -> dict[str, dict[str, Any]]:
        if live_snapshot is None:
            return {}

        raw_statistics = live_snapshot.raw.get("statistics")
        if not isinstance(raw_statistics, list):
            return {}

        team_ids = self._provider_team_ids(live_snapshot)
        stats_by_side: dict[str, dict[str, Any]] = {}
        for item in raw_statistics:
            if not isinstance(item, dict):
                continue
            team_id = _nested_str(item, "team", "id")
            side = _side_for_team_id(team_id, team_ids)
            if side is None:
                continue

            stats: dict[str, Any] = {}
            raw_team_stats = item.get("statistics")
            if not isinstance(raw_team_stats, list):
                continue
            for raw_stat in raw_team_stats:
                if not isinstance(raw_stat, dict):
                    continue
                key = _stat_key(raw_stat.get("type"))
                if key is None:
                    continue
                stats[key] = _stat_value(raw_stat.get("value"))
            if stats:
                stats_by_side[side] = stats

        return stats_by_side

def _nested_str(payload: dict[str, Any], *keys: str) -> str | None:
    value: Any = payload
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _side_for_team_id(
    team_id: str | None,
    team_ids: dict[str, str | None],
) -> str | None:
    if team_id and team_ids.get("home") and team_id == team_ids["home"]:
        return "home"
    if team_id and team_ids.get("away") and team_id == team_ids["away"]:
        return "away"
    return None


def _stat_key(value: object) -> str | None:
    if value is None:
        return None
    key = re.sub(r"[^a-z0-9]+", "_", str(value).strip().casefold()).strip("_")
    return STAT_KEY_ALIASES.get(key, key or None)


def _stat_value(value: object) -> int | float | str | None:
    if value is None:
        return None
    if isinstance(value, int | float):
        return value

    text = str(value).strip()
    if not text:
        return None
    if text.endswith("%"):
        try:
            return float(text[:-1])
        except ValueError:
            return text
    try:
        number = float(text)
    except ValueError:
        return text
    return int(number) if number.is_integer() else number
