"""Configure the local shared circle without changing archive ownership."""
import argparse
from .core import Store, Denied, Conflict


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', required=True)
    parser.add_argument('--admin-name', required=True)
    parser.add_argument('--group-id')
    parser.add_argument('--map-name', action='append', default=[], metavar='NAME=USER_UUID')
    parser.add_argument('--rotate', action='store_true')
    args = parser.parse_args()
    mappings = {}
    for binding in args.map_name:
        name, separator, user = binding.rpartition('=')
        if not separator or not name or not user or name in mappings:
            parser.error('Each mapping must be a unique NAME=USER_UUID')
        mappings[name] = user
    store = Store(args.root)
    try:
        code = store.setup_shared(admin_name=args.admin_name, group_id=args.group_id,
                                  mappings=mappings, rotate=args.rotate)
        print(f'Shared code: {code}' if code else 'Shared entry already configured. Code retained.')
    except (Denied, Conflict) as error:
        parser.error(str(error))
    finally:
        store.close()


if __name__ == '__main__':
    main()
