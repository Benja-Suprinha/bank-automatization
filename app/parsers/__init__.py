from collections.abc import Callable

from .cencosud import ParsedTransaction, parse_cencosud

PARSER_REGISTRY: dict[str, Callable[[str, str], ParsedTransaction]] = {"cencosud": parse_cencosud}
