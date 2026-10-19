"""Origin policy shared by the archive HTTP boundaries."""

from mazi.identity.core import Denied


def validate_origin(origin: str | None, host: str) -> None:
    if origin is not None and origin not in (f'http://{host}', f'https://{host}'):
        raise Denied('Invalid origin')
