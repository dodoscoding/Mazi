"""Explicit model installation. Inference never calls this network-enabled module."""
import argparse
from pathlib import Path
import subprocess
from .clip_manifest import FILES, REPOSITORY, REVISION, verify_file


def download(root):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    if any(p.is_symlink() for p in [root, *root.parents]):
        raise ValueError('Choose a real directory, not a symlink')
    for name, specification in FILES.items():
        target = root / name
        if target.exists():
            verify_file(target, specification)
            print('Verified ' + name, flush=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.parent.is_symlink():
            raise ValueError('Model subdirectory cannot be a symlink')
        part = target.with_name(target.name + '.part')
        if part.is_symlink():
            raise ValueError('Temporary file cannot be a symlink')
        try:
            subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--proto', '=https', '--proto-redir', '=https', '--connect-timeout', '30', '--max-time', '300', '--retry', '2', '--max-filesize', str(specification[0]), '--output', str(part), f'https://huggingface.co/{REPOSITORY}/resolve/{REVISION}/{name}'], check=True)
            verify_file(part, specification)
            part.replace(target)
            print('Installed ' + name, flush=True)
        finally:
            part.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download and verify the pinned public CLIP files (~156 MB). No archive data is transmitted.')
    parser.add_argument('--directory', default='.models/clip-vit-base-patch32')
    download(parser.parse_args().directory)
