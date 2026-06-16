from __future__ import annotations

from typing import Any


class MCPClient:
    def __init__(self) -> None:
        self.config: dict[str, Any] | None = None
        self.tool_name_prefix = False

    def configure(self, config: dict[str, Any], *, tool_name_prefix: bool = False) -> None:
        self.config = config
        self.tool_name_prefix = tool_name_prefix

    async def get_tools(self) -> list[Any]:
        return []


mcp_client = MCPClient()

